DROP TABLE IF EXISTS BLUsers;
CREATE TABLE IF NOT EXISTS BLUsers (
    ind INTEGER PRIMARY KEY AUTOINCREMENT,
    record_time INTEGER NOT NULL,
    uid INTEGER NOT NULL,
    name TEXT,
    attention INTEGER,
    roomid INTEGER,
    live_title TEXT,
    live_status INTEGER,
    live_start_time INTEGER,
    live_watchers INTEGER,
    guard_num INTEGER,
    guard_details TEXT
);
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