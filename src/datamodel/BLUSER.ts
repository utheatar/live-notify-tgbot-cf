class USER_BL {
    name: string;
    uid: number | string;
    attention: number;
    roomid: number | string;
    live_title: string;
    live_status: number;
    live_start_time: number;
    live_watchers: number;
    guard_num: number;
    guard_details: string;

    constructor(
        name: string,
        uid: number | string,
        attention: number,
        roomid: number | string,
        live_title: string,
        live_status: number,
        live_start_time: number,
        live_watchers: number,
        guard_num: number,
        guard_details: string) {
        this.name = name;
        this.uid = uid;
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