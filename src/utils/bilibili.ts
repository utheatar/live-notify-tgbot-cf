const BLLIVEINFOS_ENDPOINT_Vercel = 'https://api-forwarding-vc.vercel.app/api/bili/liveinfos';
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
 * Fetch liveinfos for given uids via GET (uids[] params)
 */
export async function fetchLiveInfosVC(uids: string[] | number[]) {
    if (!uids || uids.length === 0) return null;
    // Use POST with JSON body to avoid excessively long URLs
    const url = BLLIVEINFOS_ENDPOINT_Vercel;
    const body = { uids: uids.map((u) => Number(u)) };
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`liveinfos fetch failed: ${resp.status}`);
    const json = await resp.json();
    return json;
}

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