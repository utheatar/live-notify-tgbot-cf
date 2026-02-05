DROP TABLE IF EXISTS BLUsers;
CREATE TABLE IF NOT EXISTS BLUsers (
    ind INTEGER PRIMARY KEY AUTOINCREMENT,
    record_time INTEGER,
    name TEXT,
    uid INTEGER,
    room_id INTEGER,
    live_status INTEGER,
    title TEXT,
    live_time INTEGER,
    attention INTEGER,
    onlineNum INTEGER,
    audience_rank TEXT, -- 存储 JSON
    guardNum INTEGER,
    guardDetail TEXT,   -- 存储 JSON
    tags TEXT,
    parent_area_id INTEGER,
    parent_area_name TEXT,
    area_id INTEGER,
    area_name TEXT
);

-- 可选：创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_uid_time ON BLUsers (uid, record_time);

DROP TABLE IF EXISTS DYUsers;
CREATE TABLE IF NOT EXISTS DYUsers (
    ind INTEGER PRIMARY KEY AUTOINCREMENT,
    record_time INTEGER NOT NULL,
    sec_uid TEXT NOT NULL,
    nickname TEXT NOT NULL,
    live_status INTEGER NOT NULL,
    follower_count INTEGER,
    max_follower_count INTEGER,
    total_favorited INTEGER,
    ip_location TEXT,
    signature TEXT
);