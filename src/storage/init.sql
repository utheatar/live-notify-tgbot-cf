DROP TABLE IF EXISTS BLUsers;
CREATE TABLE IF NOT EXISTS BLUsers (
    record_time INTEGER PRIMARY KEY,
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