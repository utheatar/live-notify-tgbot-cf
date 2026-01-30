import { BLUSER } from "../datamodel/USER_BL";
import { DYUser } from "../datamodel/DY";

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
     * @param {BLUSER} bl_user - 要插入的 BLUSER 实例。
     * @returns {Promise<void>} 操作完成的 Promise。
     */
    async insertUserBL(bl_user: BLUSER): Promise<void> {
        const query = `
            INSERT INTO BLUsers (record_time, uid, name, attention, roomid, live_title, live_status, live_start_time, live_watchers, guard_num, guard_details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            bl_user.record_time,
            bl_user.uid,
            bl_user.name,
            bl_user.attention,
            bl_user.roomid,
            bl_user.live_title,
            bl_user.live_status,
            bl_user.live_start_time,
            bl_user.live_watchers,
            bl_user.guard_num,
            bl_user.guard_details
        ];
        await this.db.prepare(query).bind(...params).run();
    }

    /**
     * 获取指定 UID 的 BLUSER 记录。
     * @param {number | string} uid - 要查询的用户 UID。
     * @returns {Promise<BLUSER | null>} 查询结果的 Promise，如果未找到则返回 null。
     */
    async getUserBL(uid: number | string): Promise<BLUSER | null> {
        const query = `SELECT * FROM BLUsers WHERE uid = ?;`;
        const result = await this.db.prepare(query).bind(uid).first<BLUSER>();
        return result || null;
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
