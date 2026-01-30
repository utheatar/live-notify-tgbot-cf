import { douyinSign } from './sign';
import { getBaseParams } from './defaultConfig';


/**
 * 获取抖音用户主页资料
 * @param {string} sec_uid 抖音主播的sec_uid，可从主页链接Url中获取
 * @param {string} cookie 抖音cookie
 * @param {string} userAgent 浏览器的UA
 * @returns {Promise<Response>} 抖音接口的Response
 */
export async function fetchDouyinUserProfile(sec_uid: string, cookie: string, userAgent: string): Promise<Response> {
    const baseUrl = 'https://www.douyin.com/aweme/v1/web/user/profile/other/';

    // 检查函数参数
    if (!sec_uid || sec_uid.length === 0) {
        return new Response('sec_uid is required', { status: 400 });
    }
    if (!cookie || cookie.length === 0) {
        return new Response('cookie is required', { status: 400 });
    }
    if (!userAgent || userAgent.length === 0) {
        return new Response('userAgent is required', { status: 400 });
    }

    // 构造参数
    const params = new URLSearchParams({
        ...getBaseParams(),
        publish_video_strategy_type: '2',
        source: 'channel_pc_web',
        sec_user_id: sec_uid,
        personal_center_strategy: '1',
    });

    // 拼接未签名的 URL
    const unsignedUrl = `${baseUrl}?${params.toString()}`;

    // --- 2. 关键修改：签名时必须使用与 Header 相同的 User-Agent ---
    // amagi 中默认 userProfile 使用 a_bogus (douyinSign.AB)
    const a_bogus = douyinSign.AB(unsignedUrl, userAgent);

    // 拼接最终 URL
    const finalUrl = `${unsignedUrl}&a_bogus=${a_bogus}`;

    // 发送请求
    try {
        const response = await fetch(finalUrl, {
            method: 'GET',
            headers: {
                'User-Agent': userAgent,
                'Referer': `https://www.douyin.com/user/${sec_uid}`,
                'Cookie': cookie
            },
            cf: {
                cacheTtl: 0,
                cacheEverything: false
            }
        });

        if (!response.ok) {
            throw new Error(`Douyin API fetch Error: ${response.status}`);
        }

        // const data = await response.json();
        // return new Response(JSON.stringify(data), { status: 200 });
        return response;

    } catch (error) {
        console.error('Fetch Douyin Profile Error:', error);
        return new Response('Internal Server Error:' + error, { status: 500 });
    }
}

// Douyin user profile API response type
export type DouyinUserProfileResponse = {
    status_code: number;
    status_msg: string | null;
    user: {
        sec_uid: string;
        nickname: string;
        room_id: number;
        room_id_str: string;
        live_status: number | string;
        follower_count: number;
        following_count: number;
        max_follower_count: number;
        gender: number;
        ip_location: string;
        store_region: string;
        uid: string;
        role_id: string;
        short_id: string;
        signature: string;
        total_favorited: number;
        user_age: number;
    };
};