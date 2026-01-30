import { DYUser } from "../datamodel/DY";
import { fetchDouyinUserProfile, DouyinUserProfileResponse } from "../platforms/douyin/userprofile";


const DYLIVEINFO_ENDPOINT = 'https://api-forwarding-vc.vercel.app/api/dy/liveinfo';

/**
 * Fetch Douyin live info for given sec_user_id values.
 * The Douyin endpoint does not support multi-id queries, so we request each id separately
 * and merge results into an object shaped like { apisuccess: boolean, data: { secId: info } }.
 */
// export async function fetchDyInfos(secIds: string[] | number[]) {
//     if (!secIds || secIds.length === 0) return null;

//     const results: { apisuccess: boolean; data: Record<string, any>; errors?: any[] } = {
//         apisuccess: false,
//         data: {},
//         errors: [],
//     };

//     const tasks = secIds.map(async (s) => {
//         const sec = String(s);
//         const url = `${DYLIVEINFO_ENDPOINT}?sec_user_id=${encodeURIComponent(sec)}`;
//         try {
//             const resp = await fetch(url, { method: 'GET' });
//             if (!resp.ok) {
//                 results.errors!.push({ sec, status: resp.status });
//                 return;
//             }
//             const json = await resp.json();
//             if (json && json.apisuccess && json.data) {
//                 // Attach under the sec id key so consumers can lookup by the original id
//                 results.data[sec] = json.data;
//                 results.apisuccess = true;
//             } else {
//                 results.errors!.push({ sec, body: json });
//             }
//         } catch (e) {
//             results.errors!.push({ sec, error: String(e) });
//         }
//     });

//     await Promise.all(tasks);

//     // if no successful entries, keep apisuccess false
//     return results;
// }

/**
 * Fetch liveinfos for given uids via GET (uids[] params)
 */
export async function fetchDYLiveInfo(sec_user_id: string) {
    if (!sec_user_id || sec_user_id.length === 0) return null;
    // Use POST with JSON body to avoid excessively long URLs
    const url = DYLIVEINFO_ENDPOINT;
    const body = { "sec_user_id": sec_user_id };
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`douyin upstream api fatal: ${resp.status}`);
    const json = await resp.json();
    return json;
}

export async function getDYUserInfo(sec_uid: string, cookie: string, userAgent: string): Promise<DYUser | null> {
    // 检查参数
    if (!sec_uid || sec_uid.length === 0) {
        throw new Error('sec_uid is required');
    }
    // 调用平台函数获取用户信息
    const apiResp = await fetchDouyinUserProfile(sec_uid, cookie, userAgent);
    if (!apiResp.ok) throw new Error(`douyin user profile fetch error: ${apiResp.status}`);
    const apiData = (await apiResp.json()) as DouyinUserProfileResponse;

    // 检查API返回状态
    if (!apiData || apiData.status_code !== 0 || !apiData.user) {
        console.log('getDYUserInfo: api response invalid', apiData);
        return null;
    }

    const user = apiData.user;
    return {
        sec_uid: user.sec_uid || '',
        nickname: user.nickname || '',
        room_id: user.room_id || 0,
        room_id_str: user.room_id_str || '0',
        live_status: user.live_status || 0,
        follower_count: user.follower_count || 0,
        following_count: user.following_count || 0,
        max_follower_count: user.max_follower_count || 0,
        gender: user.gender || 0,
        ip_location: user.ip_location || '',
        store_region: user.store_region || '',
        uid: user.uid || '',
        role_id: user.role_id || '',
        short_id: user.short_id || '',
        signature: user.signature || '',
        total_favorited: user.total_favorited || 0,
        user_age: user.user_age || 0,
    } as DYUser;
}
