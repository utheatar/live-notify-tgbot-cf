import { HEADERS } from "./constant";

// 定义原始接口返回中列表项的结构
interface RawRankItem {
    userRank: number;
    uid: number;
    name: string;
    face: string;
    score: number;
    guard_level: number;
    wealth_level: number;
    // 其他字段根据需要可以继续添加，目前只需提取上述字段
}

// 定义原始接口返回中 data 的结构
interface RawRankData {
    onlineNum: number;
    onlineNumText?: string;
    OnlineRankItem: RawRankItem[];
    // ownInfo 等其他字段暂不需要
}

interface RoomAudienceRankResponse {
    code: number;
    message: string;
    ttl: number;
    data: RawRankData;
}

export interface AudienceRankItem {
    uid: number;
    name: string;
    userRank: number;
    guard_level: number;
    wealth_level: number;
}

export interface RoomAudienceRank {
    // 当前在线观众总数
    onlineNum: number;
    // 不可靠
    rankList: AudienceRankItem[];
}

/**
 * 根据ruid和roomid获取直播间观众排名
 * @param ruid 主播uid
 * @param roomid 直播间id
 * @param page 当前页数
 * @param page_size 每页数量
 * @returns 观众排名数据
 */
export async function fetchRoomAudienceRank(
    ruid: number,
    roomid: number,
    page: number = 1,
    page_size: number = 20
): Promise<RoomAudienceRank> {
    const endpoint = 'https://api.live.bilibili.com/xlive/general-interface/v1/rank/getOnlineGoldRank';
    // 构造查询参数
    const params = new URLSearchParams({
        ruid: String(ruid),
        roomId: String(roomid),
        page: String(page),
        pageSize: String(page_size),
    });
    // 完整请求URL
    const url = `${endpoint}?${params.toString()}`;
    const headers = HEADERS;
    // 发送请求
    const apiResp: Response = await fetch(url, {
        method: 'GET',
        headers: headers,
    });
    // 处理网络层面的错误
    if (!apiResp.ok) {
        throw new Error(`Network response was not ok, status: ${apiResp.status}`);
    }

    const respJson: RoomAudienceRankResponse = await apiResp.json();
    // 处理响应
    if (respJson.code === 0) {
        if (respJson.data) {
            const data = respJson.data;
            // 提取在线人数
            const onlineNum = data.onlineNum || 0;
            // 提取并映射列表数据
            const rawList = data.OnlineRankItem || [];
            const rankList: AudienceRankItem[] = rawList.map((item) => ({
                uid: item.uid,
                name: item.name,
                userRank: item.userRank,
                guard_level: item.guard_level,
                wealth_level: item.wealth_level,
            }));

            return {
                onlineNum,
                rankList
            };
        } else {
            // 虽然 code 为 0，但没有 data 数据
            return {
                onlineNum: 0,
                rankList: []
            };
        }
    } else {
        throw new Error(`API fetch error, code: ${respJson.code}, message: ${respJson.message}`);
    }
}