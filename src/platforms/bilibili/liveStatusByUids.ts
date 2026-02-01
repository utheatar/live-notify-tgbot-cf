import { HEADERS } from "./constant";

export interface LiveStatus {
    uid: number;
    room_id: number;
    title: string;
    live_status: number; // 0: 未开播, 1: 正在直播, 2: 轮播中
    live_time: number;
    uname: string;
    cover_from_user: string;
    // 以下字段不可靠，可能与真实直播内容不符，谨慎使用
    tag_name: string;
    tags: string;
    area: string;
    area_name: string;
    area_v2_id: number;
    area_v2_name: string;
    area_v2_parent_name: string;
    area_v2_parent_id: number;
}

export interface LiveStatusBatch {
    [uid: number]: LiveStatus;
}

interface ApiResponse {
    code: number;
    msg: string;
    message: string;
    data: object;
}

/**
 * 获取多个UID的直播状态
 * @param uids 用户UID列表
 * @param reqMethod 请求方法，支持 'GET' 和 'POST'，默认为 'GET'
 * @returns 直播状态批量结果
 */
export async function fetchLiveStatusByUids(
    uids: number[] | string[],
    reqMethod: string = 'GET'
): Promise<LiveStatusBatch> {
    // 参数检查
    if (!Array.isArray(uids) || uids.length === 0) {
        throw new Error('UIDs array is empty');
    }
    const method = reqMethod.toUpperCase();
    if (method !== 'GET' && method !== 'POST') {
        throw new Error('Invalid request method');
    }

    const endpoint = 'https://api.live.bilibili.com/room/v1/Room/get_status_info_by_uids';
    const headers = HEADERS;
    // 构造请求
    let url = endpoint;
    let body: string | undefined;
    if (method === 'GET') {
        // GET 方式：构造 uids[]=xxx&uids[]=yyy 形式的查询参数
        const params = new URLSearchParams();
        uids.forEach((uid) => {
            params.append('uids[]', String(uid));
        });
        url = `${endpoint}?${params.toString()}`;
    } else {
        // POST 方式：构造 JSON Body {"uids": [123, 456]}
        // 为了稳健，将 uid 统一转换为数字类型 (参考文档 POST 示例为数字)
        const numericUids = uids.map((id) => Number(id));
        body = JSON.stringify({ uids: numericUids });
    }
    // 发送请求
    const apiResp: Response = await fetch(url, {
        method: method,
        headers: headers,
        body: body,
    });
    // 处理响应
    if (!apiResp.ok) {
        throw new Error(`Network response was not ok, status: ${apiResp.status}`);
    }
    const respJson: ApiResponse = await apiResp.json();
    if (respJson.code == 0) {
        if (respJson.data && typeof respJson.data === 'object') {
            const result: Record<number, LiveStatus> = {};
            for (const [key, value] of Object.entries(respJson.data)) {
                const uid = Number(key);
                result[uid] = value as LiveStatus;
            }
            return result;
        } else {
            throw new Error('No data received: invalid parameters or other error');
        }
    } else {
        throw new Error(`API fetch error, code: ${respJson.code}, message: ${respJson.message}`);
    }
}