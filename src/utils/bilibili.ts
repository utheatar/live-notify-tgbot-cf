import { GuardInfo, GuardInfoItem, fetchGuardInfo } from "../platforms/bilibili/guardInfo";
import { RoomAudienceRank, fetchRoomAudienceRank, AudienceRankItem } from "../platforms/bilibili/roomAudienceRank";
import { RoomBaseInfo, fetchRoomInfosByRoomids } from "../platforms/bilibili/roomInfoByRoomids";

const URL_LIVE_INFOS_BY_UIDS = 'https://api.live.bilibili.com/room/v1/Room/get_status_info_by_uids';

// 单个用户信息的类型
type UserInfo = {
    title: string;
    room_id: number;
    uid: number;
    live_time: number;
    live_status: number;
    uname: string;
};

// data 字段的类型：以 uid 为键，UserInfo 为值的对象
type UserDataMap = Record<string, UserInfo>;

// 完整的 API 响应类型
type LiveInfoResponse = {
    code: number;
    msg: string;
    message: string;
    data: UserDataMap;
};


/**
 * Fetch liveinfos by uids via POST
 * @param uids Array of user IDs
 * @returns LiveInfoResponse object
 */
export async function fetchLiveInfosByUIDs(uids: string[] | number[]): Promise<LiveInfoResponse> {
    if (!uids || uids.length === 0) throw new Error('uids array is empty');
    const url = URL_LIVE_INFOS_BY_UIDS;
    const body = { uids: uids.map((u) => Number(u)) };
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`liveinfos fetch failed: ${resp.status}`);
    const json = await resp.json();
    return json as LiveInfoResponse;
}

// KV 中 B站 uid_roomid 项
export interface BLStreamerBaseItem {
    uid: number;
    roomid: number;
    name: string;
}

// KV 中 B站 监测主播项
export interface BLStreamerItem extends BLStreamerBaseItem {
    live_status: number;    // 0: not live, 1: live
    attention: number;
    onlineNum: number;
    guardNum: number;
}

// 完整的 主播状态信息 类型
export interface BLStreamerStatusInfo {
    // 基础身份信息
    uid: number;
    room_id: number;
    name: string;
    // 核心状态
    live_status: number; // 0: 下播, 1: 直播, 2: 轮播
    cover: string;
    attention: number;        // 关注主播的用户数量
    title: string;
    // --- 补充字段 (用于数据库记录) ---
    tags: string;
    parent_area_id: number;
    parent_area_name: string;
    area_id: number;
    area_name: string;
    // 动态数据，仅直播时有效
    live_time: number;        // 开播时间戳 (秒)
    // 进阶数据 (仅直播时去获取，否则为空)
    guard_count?: number;    // 舰长总数
    guard_members?: GuardInfoItem[];           // 舰长列表信息
    online_num?: number;     // 实时在线人数
    audience_rank?: AudienceRankItem[]; // 高能榜/在线观众排名
}

/**
 * 批量获取 B站 主播的完整状态信息 (基础信息 + 舰长 + 观众榜)
 * * 优化策略：
 * 1. 批量获取基础信息。
 * 2. 仅对【直播中】的主播，并发获取舰长和观众榜数据。
 * @param streamers 主播列表 (来自 KV)
 * @returns 完整的状态信息列表
 */
export async function getBLStreamerStatusInfoList(
    streamers: BLStreamerBaseItem[]
): Promise<BLStreamerStatusInfo[]> {
    if (!streamers || streamers.length === 0) {
        return [];
    }
    // 1. 提取所有 roomid 进行批量基础信息查询
    const roomIds = streamers.map(s => s.roomid);
    let roomBasicMap: Record<string, RoomBaseInfo> = {};
    try {
        roomBasicMap = await fetchRoomInfosByRoomids(roomIds);
    } catch (e) {
        console.error('Failed to fetch batch room infos:', e);
        // 容错处理：继续执行，后续 basicInfo 为空，使用默认值
    }

    // 2. 构建详情查询任务
    const tasks = streamers.map(async (streamer) => {
        const uid = streamer.uid;
        const roomId = streamer.roomid;

        // 获取基础信息 (注意 key 是字符串)
        const basicInfo = roomBasicMap[String(roomId)];

        // 初始化默认状态
        const status: BLStreamerStatusInfo = {
            uid: uid,
            room_id: roomId,
            name: streamer.name, // 优先使用 KV 里的名字
            live_status: 0,
            cover: '',
            attention: 0,
            title: '',
            live_time: 0,
            tags: basicInfo ? basicInfo.tags : '',
            parent_area_id: basicInfo ? basicInfo.parent_area_id : 0,
            parent_area_name: basicInfo ? basicInfo.parent_area_name : '',
            area_id: basicInfo ? basicInfo.area_id : 0,
            area_name: basicInfo ? basicInfo.area_name : '',
        };

        if (basicInfo) {
            // 如果 API 返回了名字，优先使用 API 的名字 (防止主播改名后 KV 未更新)
            status.name = basicInfo.uname || status.name;
            status.live_status = basicInfo.live_status;
            status.title = basicInfo.title;
            status.cover = basicInfo.cover;
            status.attention = basicInfo.attention;
            // 时间戳转换: 字符串 "yyyy-MM-dd HH:mm:ss" -> 秒级时间戳
            status.live_time = basicInfo.live_time === '0000-00-00 00:00:00'
                ? 0
                : Math.floor(new Date(basicInfo.live_time).getTime() / 1000);
        }

        // 3. 只有【正在直播 (live_status === 1)】时，才去查舰长和观众榜
        if (status.live_status === 1) {
            try {
                // 并发执行两个详情查询 (使用 allSettled 容错，一个挂了不影响另一个)
                const [guardData, audienceData] = await Promise.allSettled([
                    fetchGuardInfo(roomId, uid),      // 查舰长
                    fetchRoomAudienceRank(uid, roomId)// 查高能榜
                ]);

                // 处理舰长数据
                if (guardData.status === 'fulfilled') {
                    // 将 GuardInfo 对象拆解并赋值
                    status.guard_count = guardData.value.total;
                    status.guard_members = guardData.value.members;
                } else {
                    console.warn(`Fetch guard info failed for ${streamer.name}:`, guardData.reason);
                }

                // 处理观众数据
                if (audienceData.status === 'fulfilled') {
                    // 将 RoomAudienceRank 对象拆解并赋值
                    status.online_num = audienceData.value.onlineNum;
                    status.audience_rank = audienceData.value.rankList;
                } else {
                    console.warn(`Fetch audience rank failed for ${streamer.name}:`, audienceData.reason);
                }

            } catch (detailError) {
                console.error(`Error fetching details for ${streamer.name}:`, detailError);
            }
        }

        return status;
    });

    // 等待所有主播的数据处理完成
    const results = await Promise.all(tasks);
    return results;
}
