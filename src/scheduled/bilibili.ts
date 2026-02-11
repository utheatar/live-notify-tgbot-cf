import { TelegramBot } from '../platforms/telegram/bot';
import { KVStore } from '../storage/KVStore';
import { KEY_UID_ROOMID, KEY_LAST_STATUS } from '../constants/KVstoreKey';
import { D1Store } from '../storage/D1DB';
import { BLStreamerBaseItem, getBLStreamerStatusInfoList } from '../platforms/bilibili/aggregation';

// 定义 KV 中 last_status 的存储结构 (精简版，用于比对)
export interface BLLastStatusCache {
    uid: number;
    roomid: number;
    name: string;
    attention: number;
    live_status: number;
    title: string;
    live_time: number;
    onlineNum: number; // 注意：KV里你定义的是 onlineNum
    guardNum: number;  // 注意：KV里你定义的是 guardNum
}

export async function runTask_BL(env: Env): Promise<string> {
    const chatId = env.CHAT_ID;
    const botToken = env.BOT_TOKEN;
    const bot = new TelegramBot(botToken);

    // init KVStore for BL
    const kv = env.live_notify_tgbot;
    const BLStore: KVStore = new KVStore(kv, 'BL');
    // init D1Store for database writes
    const dbStore = new D1Store(env.live_notify);
    // 1. 获取监控列表 (Streamer List)
    const userList = await BLStore.getJson<BLStreamerBaseItem[]>(KEY_UID_ROOMID) || [];
    if (!userList || userList.length === 0) {
        return 'No streamers to monitor.';
    }
    // 2. 获取上次缓存的状态 (Last Status)
    const lastStatusRaw = await BLStore.getJson<BLLastStatusCache[]>(KEY_LAST_STATUS) || [];
    // 转为 Map 方便 O(1) 查找: uid -> Status
    const lastStatusMap = new Map<number, BLLastStatusCache>();
    lastStatusRaw.forEach(item => lastStatusMap.set(item.uid, item));
    // 3. 获取当前最新状态 (Current Status)
    const currentStatusList = await getBLStreamerStatusInfoList(userList);

    // 准备新的缓存列表
    const newStatusCache: BLLastStatusCache[] = [];
    // 收集数据库写入 Promise
    const dbPromises: Promise<void>[] = [];
    // 消息发送计数
    let notifyCount = 0;
    // 是否需要更新 KV 缓存的标志
    let updateKV_flag = false;
    if (currentStatusList.length !== lastStatusRaw.length) {
        updateKV_flag = true;
    }

    // 4. 遍历比对
    for (const curr of currentStatusList) {
        const last = lastStatusMap.get(curr.uid);

        // 构造当前用于缓存的结构 (字段名对齐 KV 定义)
        const currCache: BLLastStatusCache = {
            uid: curr.uid,
            roomid: curr.room_id,
            name: curr.name,
            live_status: curr.live_status,
            attention: curr.attention,
            title: curr.title,
            live_time: curr.live_time,
            onlineNum: curr.online_num || 0,
            guardNum: curr.guard_count || 0
        };
        newStatusCache.push(currCache);

        // --- 推送判断&推送 ---
        // 仅 live_status 变化时推送
        if (last) {
            // 下播 -> 开播 (0/2 -> 1)
            if (last.live_status !== 1 && curr.live_status === 1) {
                const msg = `_Bilibili_\n${curr.name} - *正在直播！*\n> ${curr.title}`;
                await bot.sendMessage(chatId, msg); // 建议sendMessage支持parse_mode
                notifyCount++;
                updateKV_flag = true;
            }
            // 开播 -> 下播 (1/2 -> 0)
            else if (last.live_status !== 0 && curr.live_status === 0) {
                const msg = `_Bilibili_\n${curr.name} - 已下播`;
                await bot.sendMessage(chatId, msg);
                notifyCount++;
                updateKV_flag = true;
            }
        } else {
            // 如果是第一次添加监控且正在直播，也可以选择推送(可选)
            if (curr.live_status === 1) {
                const msg = `_Bilibili_ (新增监控)\n${curr.name} - *正在直播！*\n> ${curr.title}`;
                await bot.sendMessage(chatId, msg);
                updateKV_flag = true;
            }
        }

        // --- 数据库写入判断 ---
        let needWrite = false;
        if (!last) {
            // 如果是第一次抓取，且正在直播，或者有数据，建议写入一条初始记录
            needWrite = true;
        } else {
            // 1. live_status 变化
            if (curr.live_status !== last.live_status) {
                needWrite = true;
                updateKV_flag = true;
            };
            // 2. attention 变化
            if (curr.attention !== last.attention) {
                needWrite = true;
                updateKV_flag = true;
            }
            // 3. live_status == 1 时的其他字段变化
            if (curr.live_status === 1) {
                if (curr.title !== last.title) {
                    needWrite = true;
                    updateKV_flag = true;
                }
                if (curr.online_num !== last.onlineNum) {
                    needWrite = true;
                    updateKV_flag = true;
                }
                if (curr.guard_count !== last.guardNum) {
                    needWrite = true;
                    updateKV_flag = true;
                }
            }
        }

        if (needWrite) {
            dbPromises.push(dbStore.insertStreamerStatus_BL(curr));
        }
    }

    // 5. 更新 KV 缓存
    if (updateKV_flag) {
        await BLStore.setJson(KEY_LAST_STATUS, newStatusCache);
    }

    // 6. 等待所有数据库操作完成
    await Promise.allSettled(dbPromises);

    return `Processed ${userList.length} streamers. Notified: ${notifyCount}. DB Writes: ${dbPromises.length}`;;
}
