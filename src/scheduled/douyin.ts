import { TelegramBot } from '../platforms/telegram/bot';
import { KVStore } from '../storage/KVStore';
import { KEY_USERLIST, KEY_LAST_INFO_STATUS } from '../constants/KVstoreKey';
import { D1Store } from '../storage/D1DB';
import { getDYUserInfo } from '../platforms/douyin/api';

export async function runTask_DY(env: Env): Promise<string> {
    const chatId = env.CHAT_ID;
    const botToken = env.BOT_TOKEN;
    const kv = env.live_notify_tgbot;

    if (!kv || !botToken || !chatId) {
        return 'Missing env vars for DY task';
    }

    const bot = new TelegramBot(botToken);

    // init KVStore
    const DYStore: KVStore = new KVStore(kv, 'DY');
    // init D1Store for database writes
    const dbStore = new D1Store(env.live_notify);
    // read userlist from KVStore
    const sec_user_ids = (await DYStore.getJson<number[] | string[]>(KEY_USERLIST)) || [];
    if (!sec_user_ids || sec_user_ids.length === 0) {
        return 'No DY users to monitor';
    }

    const liveMessages: string[] = [];
    const loopMessages: string[] = [];
    const offlineMessages: string[] = [];

    // read previous statuses (mapping sec_user_id -> live_status) from KVStore
    const prev = (await DYStore.getJson<Record<string, number>>(KEY_LAST_INFO_STATUS)) || {};
    // Persist next statuses here. All statuses will be written back at once to save KV writes
    const nextPrev: Record<string, number> = {};
    // count changed statuses
    let changedCount = 0;

    // get env vars for Douyin API
    const cookie = env.DY_COOKIE1 || '';
    const userAgent = env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36';

    // fetch current live infos per sec_user_id
    for (const sec_user_id of sec_user_ids) {
        let cur: any;
        try {
            cur = await getDYUserInfo(String(sec_user_id), cookie, userAgent);
        } catch (e) {
            console.log('runTask_DY: fetch error', String(e));
            continue;
        }
        if (!cur) {
            console.log('runTask_DY: api fetch failed for', sec_user_id);
            continue;
        }
        // console.log(cur);
        const live_status = cur.live_status ?? 0;
        const prevStatus = prev[String(sec_user_id)];

        // 判断直播状态是否变化
        const isLiveStatusChanged = prevStatus === undefined || prevStatus !== live_status;
        // 若无变化则跳过
        if (!isLiveStatusChanged) {
            // still record current status for persistence
            nextPrev[String(sec_user_id)] = live_status;
            continue;
        }
        // 若直播状态有变化，则进行下述处理
        changedCount += 1;
        // record current status for persistence
        nextPrev[String(sec_user_id)] = live_status;
        // write to database
        try {
            await dbStore.insertUserDY(cur);
        } catch (e) {
            console.log('runTask_DY: failed to write to database', String(e));
        }
        // format message to send
        const nickname = cur.nickname || '';
        if (live_status === 0) {
            // 下播：简洁格式，与 Bilibili 保持一致
            offlineMessages.push(`${nickname} - 已下播`);
        } else if (live_status === 1) {
            // 直播中：包含详细信息
            const parts = [`${nickname} - *正在直播！*`];
            if (cur.signature) parts.push(`> ${cur.signature}`);
            if (cur.ip_location) parts.push(cur.ip_location);
            liveMessages.push(parts.join('\n'));
        } else if (live_status === 2) {
            // 轮播
            loopMessages.push(`${nickname} - 轮播中`);
        } else {
            loopMessages.push(`${nickname} - status: ${live_status}`);
        }
    }

    // persist latest DY statuses
    if (changedCount > 0) {
        try {
            await DYStore.setJson(KEY_LAST_INFO_STATUS, nextPrev);
        } catch (e) {
            console.log('runTask_DY: failed to write last statuses', String(e));
        }
    }

    const ordered = [...liveMessages, ...loopMessages, ...offlineMessages];
    const dyMessages = ordered.length ? ordered.join('\n\n') : '';

    if (dyMessages) {
        const finalText = `_Douyin_\n${dyMessages}`;
        try {
            console.log('runTask_DY: sending messages:', finalText);
            await bot.sendMessage(chatId, finalText);
        } catch (e) {
            console.log('runTask_DY: sendMessage failed', String(e));
        }
    }

    return `Processed ${sec_user_ids.length} DY users. Changed: ${changedCount}`;
}
