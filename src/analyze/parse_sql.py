"""
parse_sql.py
将 database.sql 导入内存 SQLite，提取主播直播数据并输出为 data.js
用法: python src/analyze/parse_sql.py [--sql path/to/database.sql]
"""

import sqlite3
import json
import os
import sys
import re
from datetime import datetime, timezone, timedelta

# 时区: UTC+8
CST = timezone(timedelta(hours=8))

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SQL = os.path.join(SCRIPT_DIR, '..', 'database.sql')
OUTPUT_JS = os.path.join(SCRIPT_DIR, 'data.js')


def ts_to_iso(ts: int, is_ms: bool = False) -> str:
    """Unix timestamp → ISO 8601 string (UTC+8)"""
    if is_ms:
        ts = ts / 1000
    return datetime.fromtimestamp(ts, tz=CST).isoformat()


def hour_fraction(ts: int) -> float:
    """Unix timestamp → 小时 + 分钟小数 (0~24)"""
    dt = datetime.fromtimestamp(ts, tz=CST)
    return dt.hour + dt.minute / 60 + dt.second / 3600


def load_sql(sql_path: str) -> sqlite3.Connection:
    """读取 SQL 文件并在内存 SQLite 中执行"""
    conn = sqlite3.connect(':memory:')
    with open(sql_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    conn.executescript(sql_content)
    return conn


def process_bilibili(conn: sqlite3.Connection) -> dict:
    """处理 BLUsers 表"""
    cur = conn.execute("""
        SELECT ind, record_time, name, uid, room_id, live_status, title,
               live_time, attention, onlineNum, guardNum, guardDetail
        FROM BLUsers
        ORDER BY uid, record_time
    """)
    rows = cur.fetchall()

    # 按 uid 分组
    streamers = {}
    for row in rows:
        (ind, record_time, name, uid, room_id, live_status, title,
         live_time, attention, online_num, guard_num, guard_detail_str) = row
        uid_str = str(uid)
        if uid_str not in streamers:
            streamers[uid_str] = {
                'uid': uid,
                'name': name,
                'room_id': room_id,
                'records': []
            }
        # 更新名称（取最新）
        streamers[uid_str]['name'] = name
        streamers[uid_str]['records'].append({
            'record_time': record_time,
            'live_status': live_status,
            'title': title,
            'live_time': live_time,
            'attention': attention,
            'online_num': online_num,
            'guard_num': guard_num,
        })

    # 为每个主播生成可视化数据
    result = {}
    for uid_str, info in streamers.items():
        records = info['records']

        # ---- 1. 直播时间热力分布 (1440分钟粒度) ----
        # 对每个直播场次，从首条记录到末条记录的所有分钟都计入
        # 先按 live_time 分组，找到每个 session 的 record_time 范围
        session_time_ranges = {}  # live_time -> (min_record_time, max_record_time)
        for r in records:
            if r['live_status'] == 1 and r['live_time'] and r['live_time'] > 0:
                lt = r['live_time']
                rt = r['record_time']
                if lt not in session_time_ranges:
                    session_time_ranges[lt] = (rt, rt)
                else:
                    prev_min, prev_max = session_time_ranges[lt]
                    session_time_ranges[lt] = (min(prev_min, rt), max(prev_max, rt))

        minute_counts = [0] * 1440
        for lt, (rt_min, rt_max) in session_time_ranges.items():
            # 将 record_time 范围转为分钟级时间点
            dt_start = datetime.fromtimestamp(rt_min, tz=CST)
            dt_end = datetime.fromtimestamp(rt_max, tz=CST)
            start_min = dt_start.hour * 60 + dt_start.minute
            end_min = dt_end.hour * 60 + dt_end.minute
            # 处理跨午夜的情况
            if end_min >= start_min:
                for m in range(start_min, end_min + 1):
                    minute_counts[m] += 1
            else:
                # 跨午夜: start_min -> 1439, 然后 0 -> end_min
                for m in range(start_min, 1440):
                    minute_counts[m] += 1
                for m in range(0, end_min + 1):
                    minute_counts[m] += 1

        # ---- 2. 粉丝/关注者曲线 ----
        attention_series = []
        seen_attention = set()
        for r in records:
            key = (r['record_time'], r['attention'])
            if key not in seen_attention:
                seen_attention.add(key)
                attention_series.append({
                    'time': ts_to_iso(r['record_time']),
                    'timestamp': r['record_time'],
                    'value': r['attention']
                })

        # 去重：同一时间戳只保留一条
        attention_dedup = {}
        for item in attention_series:
            attention_dedup[item['timestamp']] = item
        attention_series = sorted(attention_dedup.values(), key=lambda x: x['timestamp'])

        # ---- 3. 直播间人数变化（按场次） ----
        # 按 live_time 分组，但用 record_time 的最小值作为起点计算相对时间
        session_records = {}  # live_time -> [records]
        for r in records:
            if r['live_status'] == 1 and r['live_time'] and r['live_time'] > 0:
                lt_key = r['live_time']
                if lt_key not in session_records:
                    session_records[lt_key] = []
                session_records[lt_key].append(r)

        sessions = {}
        for lt_key, recs in session_records.items():
            recs.sort(key=lambda x: x['record_time'])
            first_rt = recs[0]['record_time']
            sessions[lt_key] = {
                'live_time': lt_key,
                'start_iso': ts_to_iso(first_rt),
                'title': recs[0]['title'],
                'data_points': []
            }
            for r in recs:
                elapsed_min = (r['record_time'] - first_rt) / 60
                sessions[lt_key]['data_points'].append({
                    'elapsed_min': round(elapsed_min, 1),
                    'record_time_iso': ts_to_iso(r['record_time']),
                    'online_num': r['online_num'],
                    'guard_num': r['guard_num'],
                    'attention': r['attention']
                })

        session_list = sorted(sessions.values(), key=lambda s: s['live_time'])
        for s in session_list:
            s['data_points'].sort(key=lambda d: d['elapsed_min'])

        # ---- 4. 大航海上舰人数变化 ----
        guard_series = []
        for r in records:
            guard_series.append({
                'time': ts_to_iso(r['record_time']),
                'timestamp': r['record_time'],
                'value': r['guard_num'],
                'live_status': r['live_status']
            })
        # 去重
        guard_dedup = {}
        for item in guard_series:
            guard_dedup[item['timestamp']] = item
        guard_series = sorted(guard_dedup.values(), key=lambda x: x['timestamp'])

        result[uid_str] = {
            'uid': info['uid'],
            'name': info['name'],
            'room_id': info['room_id'],
            'minute_distribution': minute_counts,
            'attention_series': attention_series,
            'sessions': session_list,
            'guard_series': guard_series,
        }

    return result


def process_douyin(conn: sqlite3.Connection) -> dict:
    """处理 DYUsers 表"""
    try:
        cur = conn.execute("""
            SELECT ind, record_time, sec_uid, nickname, live_status,
                   follower_count, max_follower_count, total_favorited
            FROM DYUsers
            ORDER BY sec_uid, record_time
        """)
    except sqlite3.OperationalError:
        return {}  # DYUsers 表不存在

    rows = cur.fetchall()
    streamers = {}
    for row in rows:
        (ind, record_time, sec_uid, nickname, live_status,
         follower_count, max_follower_count, total_favorited) = row

        if sec_uid not in streamers:
            streamers[sec_uid] = {
                'sec_uid': sec_uid,
                'name': nickname,
                'records': []
            }
        streamers[sec_uid]['name'] = nickname
        streamers[sec_uid]['records'].append({
            'record_time': record_time,  # 毫秒
            'live_status': live_status,
            'follower_count': follower_count,
            'max_follower_count': max_follower_count,
            'total_favorited': total_favorited,
        })

    result = {}
    for sec_uid, info in streamers.items():
        records = info['records']

        # 开播时间分布 (1440分钟粒度)
        minute_counts = [0] * 1440
        # 识别开播时刻: live_status 从 0→1 的转变点
        prev_status = 0
        for r in records:
            if r['live_status'] == 1 and prev_status == 0:
                dt = datetime.fromtimestamp(r['record_time'] / 1000, tz=CST)
                minute_idx = dt.hour * 60 + dt.minute
                minute_counts[minute_idx] += 1
            prev_status = r['live_status']

        # 粉丝曲线
        follower_series = []
        for r in records:
            follower_series.append({
                'time': ts_to_iso(r['record_time'], is_ms=True),
                'timestamp': r['record_time'],
                'value': r['follower_count']
            })

        result[sec_uid] = {
            'sec_uid': sec_uid,
            'name': info['name'],
            'minute_distribution': minute_counts,
            'follower_series': follower_series,
            'sessions': [],
            'guard_series': [],
        }

    return result


def main():
    sql_path = DEFAULT_SQL
    if len(sys.argv) > 2 and sys.argv[1] == '--sql':
        sql_path = sys.argv[2]

    sql_path = os.path.abspath(sql_path)
    print(f"[*] Loading SQL from: {sql_path}")

    conn = load_sql(sql_path)

    print("[*] Processing BLUsers (Bilibili)...")
    bl_data = process_bilibili(conn)
    print(f"    Found {len(bl_data)} streamers")

    print("[*] Processing DYUsers (Douyin)...")
    dy_data = process_douyin(conn)
    print(f"    Found {len(dy_data)} streamers")

    conn.close()

    output = {
        'platforms': {
            'bilibili': {
                'name': 'Bilibili',
                'streamers': bl_data
            },
            'douyin': {
                'name': '抖音',
                'streamers': dy_data
            }
        },
        'generated_at': datetime.now(tz=CST).isoformat()
    }

    with open(OUTPUT_JS, 'w', encoding='utf-8') as f:
        json_str = json.dumps(output, ensure_ascii=False, indent=2)
        f.write(f'// Auto-generated by parse_sql.py\nwindow.LIVE_DATA = {json_str};\n')

    print(f"[✓] Output written to: {OUTPUT_JS}")
    size_mb = os.path.getsize(OUTPUT_JS) / 1024 / 1024
    print(f"    File size: {size_mb:.2f} MB")


if __name__ == '__main__':
    main()
