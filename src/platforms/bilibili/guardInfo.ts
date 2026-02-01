import { HEADERS } from "./constant";

// --- 1. 定义 API 返回的原始数据结构 (Raw Types) ---
interface RawGuardBaseInfo {
    name: string;
    face: string;
    name_color: number;
}

interface RawGuardMedalInfo {
    name: string;
    level: number;
    guard_level: number;
    // ... 其他字段暂不需要
}

interface RawGuardGuardInfo {
    level: number;
    expired_str: string;
}

interface RawGuardUserInfo {
    uid: number;
    base: RawGuardBaseInfo;
    medal: RawGuardMedalInfo;
    guard: RawGuardGuardInfo;
}

interface RawGuardItem {
    ruid: number;
    rank: number;
    accompany: number; // 陪伴天数
    score: number;
    uinfo: RawGuardUserInfo;
}

interface RawGuardInfoObj {
    num: number; // 成员总数
    page: number; // 总页数
    now: number;  // 当前页
    anchor_guard_achieve_level: number;
    // ... 其他 UI 相关字段忽略
}

interface RawGuardData {
    info: RawGuardInfoObj;
    top3?: RawGuardItem[]; // 只有第一页可能有这个字段
    list: RawGuardItem[];
}

interface RawGuardResponse {
    code: number;
    message: string;
    ttl: number;
    data: RawGuardData;
}

export interface GuardInfoItem {
    rank: number;
    accompany_days: number;
    uid: number;
    name: string;
    medal_level: number;
    guard_level: number;
}

export interface GuardInfo {
    total: number;
    anchor_guard_achieve_level: number;
    members: GuardInfoItem[];
}

/**
 * 获取房间大航海（舰队）完整信息
 * * 策略：
 * 1. 请求指定 page (默认1)。
 * 2. 解析 total_pages。
 * 3. 如果 total_pages > current_page，并发请求剩余所有页面的数据。
 * 4. 合并 top3 和所有 list 数据。
 * @param roomid 房间ID
 * @param ruid 主播UID
 * @param page 页码，必填，为了方便考虑设置默认值为 1
 * @param page_size 每页数量，默认值为 10
 * @param typ 亲密度排序类型，typ=3,4,5分别为按周/月/总航海亲密度排序，默认值为 5
 * @returns 守护信息数据
 */
export async function fetchGuardInfo(
    roomid: number | string,
    ruid: number | string,
    page: number = 1,
    page_size: number = 10,
    typ: 3 | 4 | 5 = 5
): Promise<GuardInfo> {
    const endpoint = 'https://api.live.bilibili.com/xlive/app-room/v2/guardTab/topListNew';
    // 内部辅助函数：发送单次请求
    const fetchPage = async (p: number): Promise<RawGuardData> => {
        const params = new URLSearchParams({
            roomid: String(roomid),
            ruid: String(ruid),
            page: String(p),
            page_size: String(page_size),
            typ: String(typ)
        });

        const url = `${endpoint}?${params.toString()}`;

        const resp = await fetch(url, {
            method: 'GET',
            headers: HEADERS // 确保包含 User-Agent 等基础头
        });

        if (!resp.ok) {
            throw new Error(`Guard API HTTP error: ${resp.status}`);
        }

        const json = (await resp.json()) as RawGuardResponse;
        if (json.code !== 0) {
            throw new Error(`Guard API Logic error: ${json.message} (code: ${json.code})`);
        }
        return json.data;
    };

    // 1. 获取首个页面（通常是第一页）
    const firstPageData = await fetchPage(page);

    // 提取基础信息
    const totalCount = firstPageData.info.num;
    const totalPages = firstPageData.info.page;
    const achieveLevel = firstPageData.info.anchor_guard_achieve_level;

    // 容器用于收集所有的原始 Item
    let allRawItems: RawGuardItem[] = [];

    // 2. 如果是第一页，先处理 top3
    if (page === 1 && firstPageData.top3) {
        allRawItems.push(...firstPageData.top3);
    }
    // 添加当前页的 list
    if (firstPageData.list) {
        allRawItems.push(...firstPageData.list);
    }

    // 3. 判断是否需要递归/并发获取剩余页面
    // 只有当当前页是第1页（或者用户指定的起始页），且总页数大于当前页时，才去拉取后面的
    if (totalPages > page) {
        const pendingPromises: Promise<RawGuardData>[] = [];
        // 从下一页开始，直到最后一页
        for (let p = page + 1; p <= totalPages; p++) {
            // 为了防止页数过多触发风控，可以考虑在这里加简单的延时或者分批处理
            // 这里演示直接并发请求
            pendingPromises.push(fetchPage(p));
        }

        try {
            const restPagesData = await Promise.all(pendingPromises);
            // 按页码顺序合并数据
            // Promise.all 返回的顺序与 pendingPromises push 的顺序一致 (即页码顺序)
            restPagesData.forEach(data => {
                if (data.list) {
                    allRawItems.push(...data.list);
                }
            });
        } catch (e) {
            console.error('Failed to fetch subsequent guard pages:', e);
            // 根据业务需求，这里可以选择抛出错误，或者只返回已获取到的部分数据
            throw e; 
        }
    }

    // 4. 数据清洗与映射 (Map Raw to Output)
    const members: GuardInfoItem[] = allRawItems.map(item => ({
        rank: item.rank,
        accompany_days: item.accompany,
        uid: item.uinfo.uid,
        name: item.uinfo.base.name,
        // 这里优先取 medal 里的等级，如果为空则取 guard 里的等级，视实际数据情况而定
        medal_level: item.uinfo.medal ? item.uinfo.medal.level : 0,
        guard_level: item.uinfo.guard ? item.uinfo.guard.level : 0
    }));

    // 5. 按排名重新排序 (防止并发请求回来后顺序错乱，虽然逻辑上是按序push的，兜底一下)
    members.sort((a, b) => a.rank - b.rank);

    return {
        total: totalCount,
        anchor_guard_achieve_level: achieveLevel,
        members: members
    };
}