import { DYUser, DYUSERRECORD } from "./DY";
import { BLStreamerStatusInfo } from "../platforms/bilibili/aggregation";

/**
 * 一个用于抽象 Cloudflare D1 数据库操作的类。
 * 提供了对指定表的增删改查操作。
 */
export class D1Store {
    private readonly db: D1Database;

    /**
     * 创建一个 D1Store 实例。
     * @param {D1Database} db - 从 `env` 对象中获取的 D1 数据库实例。
     */
    constructor(db: D1Database) {
        this.db = db;
    }
    /**
     * 插入 BLUSER 记录。
     * @param info - 要插入的记录实例。
     * @returns 操作完成的 Promise。
     */
    async insertStreamerStatus_BL(info: BLStreamerStatusInfo): Promise<void> {
        const record_time = Math.floor(Date.now() / 1000);
        // 序列化复杂字段
        const audience_rank_str = info.audience_rank ? JSON.stringify(info.audience_rank) : '';
        const guard_detail_str = info.guard_members ? JSON.stringify(info.guard_members) : '';
        const query = `
            INSERT INTO BLUsers (
                record_time, name, uid, room_id, live_status, title, live_time, 
                attention, onlineNum, audience_rank, guardNum, guardDetail, 
                tags, parent_area_id, parent_area_name, area_id, area_name
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, ?
            )
        `;
        try {
            await this.db.prepare(query)
                .bind(
                    record_time,
                    info.name,
                    info.uid,
                    info.room_id,
                    info.live_status,
                    info.title,
                    info.live_time,
                    info.attention,
                    info.online_num || 0,
                    audience_rank_str,
                    info.guard_count || 0,
                    guard_detail_str,
                    info.tags,
                    info.parent_area_id,
                    info.parent_area_name,
                    info.area_id,
                    info.area_name
                )
                .run();
        } catch (error) {
            console.error('Error inserting BLUSER record:', error);
            throw error;
        }
    }


    /**
     * 插入 DYUser 记录。
     * @param {DYUser} dy_user - 要插入的 DYUser 实例。
     * @returns {Promise<void>} 操作完成的 Promise。
     */
    async insertUserDY(dy_user: DYUser): Promise<void> {
        const query = `
            INSERT INTO DYUsers (record_time, sec_uid, nickname, live_status, follower_count, max_follower_count, total_favorited, ip_location, signature)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            Date.now(),
            dy_user.sec_uid,
            dy_user.nickname,
            dy_user.live_status,
            dy_user.follower_count,
            dy_user.max_follower_count,
            dy_user.total_favorited,
            dy_user.ip_location,
            dy_user.signature
        ];
        await this.db.prepare(query).bind(...params).run();
    }
}
