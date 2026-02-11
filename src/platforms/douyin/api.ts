import { DYUser } from "../../storage/DY";
import { fetchDouyinUserProfile, DouyinUserProfileResponse } from "./userprofile";

/**
 * 获取抖音用户信息
 * @param sec_uid 抖音用户 sec_uid
 * @param cookie 抖音用户 cookie
 * @param userAgent 浏览器 userAgent
 * @returns 抖音用户信息
 */
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
