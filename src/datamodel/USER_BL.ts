/**
 * Bilibili 用户数据模型。
 * 定义了 Bilibili 用户的相关属性。
 * 用于存储和传输 Bilibili 用户的基本信息和直播状态。
 * 包括用户 ID、用户名、关注状态、直播间信息等。
 */
export class BLUSER {
    record_time: number;
    uid: string;
    name: string;
    attention: number;
    roomid: string;
    live_title: string;
    live_status: number;
    live_start_time: number;
    live_watchers: number;
    guard_num: number;
    guard_details: string;

    constructor(
        record_time: number,
        uid: string,
        name: string,
        attention: number,
        roomid: string,
        live_title: string,
        live_status: number,
        live_start_time: number,
        live_watchers: number,
        guard_num: number,
        guard_details: string
    ) {
        this.record_time = record_time;
        this.uid = uid;
        this.name = name;
        this.attention = attention;
        this.roomid = roomid;
        this.live_title = live_title;
        this.live_status = live_status;
        this.live_start_time = live_start_time;
        this.live_watchers = live_watchers;
        this.guard_num = guard_num;
        this.guard_details = guard_details;
    }
}

// test example
export const exampleUserBL = new BLUSER(
    Date.now(),
    '123456',
    'TestUser',
    1,
    '654321',
    'Live Stream Title',
    1,
    Date.now() - 3600000,
    500,
    10,
    'Guard details example'
);
