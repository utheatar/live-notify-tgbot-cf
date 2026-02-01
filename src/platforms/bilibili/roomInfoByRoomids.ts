import { HEADERS } from "./constant";

export interface RoomBaseInfo {
    room_id: number;
    uid: number;
    attention: number;
    live_status: number;
    live_url: string;
    live_time: string;
    title: string;
    uname: string;
    cover: string;
    // 不可靠字段，谨慎使用
    parent_area_id: number;
    parent_area_name: string;
    area_id: number;
    area_name: string;
    tags: string;
    description: string;
    live_id: number;
}

// 定义接口返回的整体结构
interface RoomBaseInfoResponse {
    code: number;
    message: string;
    ttl: number;
    data: {
        by_uids: {};
        // key 是 room_id 的字符串形式
        by_room_ids: Record<string, RoomBaseInfo>;
    };
}

/**
 * 通过房间ID列表获取房间基础信息
 * @param roomids 房间ID列表
 * @returns 房间基础信息的字典，key 为 room_id 字符串，value 为对应的 RoomBaseInfo 对象
 */
export async function fetchRoomInfosByRoomids(
    roomids: number[] | string[],
): Promise<Record<string, RoomBaseInfo>> {
    // 参数检查
    if (!Array.isArray(roomids) || roomids.length === 0) {
        throw new Error('RoomIDs array is empty');
    }
    const endpoint = 'https://api.live.bilibili.com/xlive/web-room/v1/index/getRoomBaseInfo';
    const headers = HEADERS;
    // 构造请求
    const params = new URLSearchParams();
    params.append('req_biz', 'web_room_componet');
    roomids.forEach((roomid) => {
        params.append('room_ids', String(roomid));
    });
    const url = `${endpoint}?${params.toString()}`;
    // 发送请求
    const apiResp: Response = await fetch(url, {
        method: 'GET',
        headers: headers,
    });
    // 处理响应
    if (!apiResp.ok) {
        throw new Error(`Network response was not ok, status: ${apiResp.status}`);
    }
    const respJson = await apiResp.json() as RoomBaseInfoResponse;
    // 根据接口返回结构处理数据并返回
    // 业务逻辑错误判断 (code 0 为成功)
    if (respJson.code !== 0) {
        throw new Error(`API fetch error, code: ${respJson.code}, message: ${respJson.message}`);
    }
    // 提取并返回 by_room_ids 数据
    const result: Record<string, RoomBaseInfo> = {};
    if (respJson.data && respJson.data.by_room_ids) {
        const rawMap = respJson.data.by_room_ids;
        // 遍历返回的字典，提取需要的字段
        Object.keys(rawMap).forEach((key) => {
            const rawItem = rawMap[key];
            if (rawItem) {
                // 显式提取字段以符合 RoomBaseInfo 接口定义
                result[key] = {
                    room_id: rawItem.room_id,
                    uid: rawItem.uid,
                    area_id: rawItem.area_id,
                    live_status: rawItem.live_status,
                    live_url: rawItem.live_url,
                    parent_area_id: rawItem.parent_area_id,
                    title: rawItem.title,
                    parent_area_name: rawItem.parent_area_name,
                    area_name: rawItem.area_name,
                    live_time: rawItem.live_time,
                    description: rawItem.description,
                    tags: rawItem.tags,
                    attention: rawItem.attention,
                    uname: rawItem.uname,
                    cover: rawItem.cover,
                    live_id: rawItem.live_id
                };
            }
        });
    }
    // 如果 data 或 by_room_ids 为空，返回空对象以防止报错
    if (respJson.data && respJson.data.by_room_ids) {
        return result;
    } else {
        return {};
    }
}