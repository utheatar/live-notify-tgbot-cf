import { sendMessage } from '../utils/telegram';
import { KVStore, KEY_USERLIST, KEY_LAST_INFO_STATUS } from '../storage/KVStore';
import { D1Store } from '../storage/D1DB';
import { fetchLiveInfosVC } from '../utils/bilibili';
import { getDYUserInfo } from '../utils/douyin';


async function getBLInfos(kv: KVNamespace): Promise<string> {
    // init KVStore for BL
    const BLStore: KVStore = new KVStore(kv, 'BL');
    // read userlist from KVStore
    const userlist = (await BLStore.getJson<number[] | string[]>(KEY_USERLIST)) || [];
    if (!userlist || userlist.length === 0) {
        console.log('getBLInfos: userlist empty');
        return '';
    }

    // fetch current live infos
    let apiResp: any;
    try {
        apiResp = await fetchLiveInfosVC(userlist);
    } catch (e) {
        console.log('getBLInfos: fetch error', String(e));
        return '';
    }

    if (!apiResp || !apiResp.apisuccess || !apiResp.data) {
        console.log('getBLInfos: api fetch failed', apiResp);
        return '';
    }

    const cur = apiResp.data;
    // read previous statuses (mapping uid -> live_status) from KVStore
    let prev = (await BLStore.getJson<Record<string, number>>(KEY_LAST_INFO_STATUS)) || {};
    let liveMessages: string[] = [];
    let loopMessages: string[] = [];
    let offlineMessages: string[] = [];
    const messages: string[] = [];
    // count of changed statuses
    let changedCount = 0;

    for (const uidKey of Object.keys(cur)) {
        const info = cur[uidKey];
        if (!info) continue;
        const uid = String(info.uid ?? uidKey);
        const uname = info.uname ?? '';
        const title = info.title ?? '';
        const tags = info.tags ?? '';
        const live_status = Number(info.live_status ?? info.livestatus ?? 0);

        const isLiveStatusChanged = Number(prev[uid]) !== live_status;

        if (!isLiveStatusChanged) { continue } else { changedCount += 1; }

        const statusTexts: Record<number, string> = {
            0: '已下播',
            1: '*正在直播！*',
            2: '轮播中',
        };
        const statusText = statusTexts[live_status] || `status: ${live_status}`;
        const header = `${uname} - ${statusText}`;
        const parts = [header];
        const body = title ? `> ${title}` : '';
        if (body && live_status !== 0) parts.push(body);
        // const footer = tags ? `${tags}` : '';
        // if (footer && live_status !== 0) parts.push(footer);
        const formatted = parts.join('\n');
        messages.push(formatted);
        if (live_status === 1) liveMessages.push(formatted);
        else if (live_status === 2) loopMessages.push(formatted);
        else offlineMessages.push(formatted);
    }

    // 节约KV写入次数
    if (changedCount > 0) {
        const nextPrev: Record<string, number> = {};
        for (const k of Object.keys(cur)) {
            nextPrev[k] = Number(cur[k].live_status ?? cur[k].livestatus ?? 0);
        }
        try {
            await BLStore.setJson(KEY_LAST_INFO_STATUS, nextPrev);
        } catch (e) {
            console.log('getBLInfos: failed to write last statuses', String(e));
        }
    }

    const ordered = [...liveMessages, ...loopMessages, ...offlineMessages];
    console.log("[debug]bl live info push: ", ordered);

    return ordered.length ? ordered.join('\n\n') : '';
}

async function getDYInfos(kv: KVNamespace, env: Env): Promise<string> {
    // init KVStore
    const DYStore: KVStore = new KVStore(kv, 'DY');
    // init D1Store for database writes
    const dbStore = new D1Store(env.streamers);
    // read userlist from KVStore
    const sec_user_ids = (await DYStore.getJson<number[] | string[]>(KEY_USERLIST)) || [];
    if (!sec_user_ids || sec_user_ids.length === 0) {
        console.log('getDYInfos: userlist empty');
        return '';
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
            console.log('getDYInfos: fetch error', String(e));
            continue;
        }
        if (!cur) {
            console.log('getDYInfos: api fetch failed for', sec_user_id);
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
            console.log('getDYInfos: failed to write to database', String(e));
        }
        // format message to send
        const statusTexts: Record<number, string> = {
            0: '已下播',
            1: '*正在直播！*',
            2: '轮播中',
        };
        const statusText = statusTexts[Number(live_status)] || `status: ${live_status}`;
        const header = `${cur.nickname || ''} - ${statusText}`;
        const signature = cur.signature || '';
        const iplocation = cur.ip_location || '';
        const parts = [header];
        if (signature) parts.push(`> ${signature}`);
        if (iplocation && live_status === 1) parts.push(iplocation);
        const formatted = parts.join('\n');
        if (live_status === 1) liveMessages.push(formatted);
        else if (live_status === 2) loopMessages.push(formatted);
        else offlineMessages.push(formatted);
    }

    // persist latest DY statuses
    if (changedCount > 0) {
        try {
            await DYStore.setJson(KEY_LAST_INFO_STATUS, nextPrev);
        } catch (e) {
            console.log('getDYInfos: failed to write last statuses', String(e));
        }
    }

    const ordered = [...liveMessages, ...loopMessages, ...offlineMessages];
    return ordered.length ? ordered.join('\n\n') : '';
}

/**
 * Main scheduled runner. Reads `uplist` from KV (env.liveinfo), fetches live infos,
 * compares against last known statuses stored under key `last_live`, and when
 * status changes sends a single combined message to CHAT_ID.
 */
export async function runScheduledPush(env: Env) {
    const kv = env.liveinfo;
    const botToken = env.BOT_TOKEN;
    const chatId = env.CHAT_ID;

    // pre-checks
    if (!kv) {
        console.log('runScheduledPush: env.liveinfo not configured');
        return;
    }
    if (!botToken) {
        console.log('runScheduledPush: BOT_TOKEN not configured');
        return;
    }
    if (!chatId) {
        console.log('runScheduledPush: CHAT_ID not configured');
        return;
    }

    // extract BL messages
    let blMessages = '';
    try {
        blMessages = await getBLInfos(kv);
    } catch (e) {
        console.log('runScheduledPush: getBLInfos error', String(e));
    }
    if (!blMessages) {
        console.log('runScheduledPush: no BL status changes');
        // continue to DY check anyway
    }

    // get DY infos
    let dyMessages = '';
    try {
        dyMessages = await getDYInfos(kv, env);
    } catch (e) {
        console.log('runScheduledPush: getDYInfos error', String(e));
    }
    if (!dyMessages) {
        console.log('runScheduledPush: no DY status changes');
    }

    // combine messages into one and send: BL first (if any), then DY
    const finalText = ((blMessages ? `_Bilibili_\n${blMessages}` : '') + (dyMessages ? `_Douyin_\n${dyMessages}` : '')).trim();
    if (!finalText) {
        console.log('runScheduledPush: no status changes to send');
        return;
    }

    // send message (use plain text by default to avoid MarkdownV2 escaping issues)
    try {
        console.log('runScheduledPush: sending messages as below:', finalText);
        const resp: any = await sendMessage(botToken, chatId, finalText);
        // Telegram API returns JSON with an `ok` boolean
        if (!resp || resp.ok !== true) {
            console.log('runScheduledPush: sendMessage responded with error', resp);
        } else {
            console.log('runScheduledPush: sendMessage ok', { message_id: resp.result?.message_id });
        }
    } catch (e) {
        console.log('runScheduledPush: sendMessage failed', String(e));
    }
}
