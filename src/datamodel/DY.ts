
// Define Douyin user profile type
export type DYUser = {
    sec_uid: string;
    nickname: string;
    room_id: number;
    room_id_str: string;
    live_status: number;
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
}

// Define Douyin user type to store
export class DYUSERRECORD {
    record_time: number;
    sec_uid: string;
    nickname: string;
    room_id: string;
    live_status: number;
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
    constructor(
        record_time: number = Date.now(),
        sec_uid: string,
        nickname: string,
        room_id: string,
        live_status: number,
        follower_count: number,
        following_count: number,
        max_follower_count: number,
        gender: number,
        ip_location: string,
        store_region: string,
        uid: string,
        role_id: string,
        short_id: string,
        signature: string,
        total_favorited: number,
        user_age: number
    ) {
        this.record_time = record_time;
        this.sec_uid = sec_uid;
        this.nickname = nickname;
        this.room_id = room_id;
        this.live_status = live_status;
        this.follower_count = follower_count;
        this.following_count = following_count;
        this.max_follower_count = max_follower_count;
        this.gender = gender;
        this.ip_location = ip_location;
        this.store_region = store_region;
        this.uid = uid;
        this.role_id = role_id;
        this.short_id = short_id;
        this.signature = signature;
        this.total_favorited = total_favorited;
        this.user_age = user_age;
    }
}