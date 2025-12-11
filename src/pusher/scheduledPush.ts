import { sendMessage } from '../utils/telegram';
import { KVStore, KEY_USERLIST, KEY_LAST_INFO_STATUS } from '../storage/KVStore';
import { fetchLiveInfos } from '../utils/bilibili';
import { fetchDYLiveInfo } from '../utils/douyin';


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
        apiResp = await fetchLiveInfos(userlist);
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
    const liveMessages: string[] = [];
    const loopMessages: string[] = [];
    const offlineMessages: string[] = [];

    for (const uidKey of Object.keys(cur)) {
        const info = cur[uidKey];
        if (!info) continue;
        const uid = String(info.uid ?? uidKey);
        const uname = info.uname ?? '';
        const title = info.title ?? '';
        const tags = info.tags ?? '';
        const live_status = Number(info.live_status ?? info.livestatus ?? 0);

        const isLiveStatusChanged = Number(prev[uid]) !== live_status;

        if (!isLiveStatusChanged) continue;

        const statusTexts: Record<number, string> = {
            0: '已下播',
            1: '*正在直播！*',
            2: '轮播中',
        };
        const statusText = statusTexts[live_status] || `status: ${live_status}`;
        const header = `${uname}（${uid}）${statusText}`;
        const body = title ? `${title}` : '';
        const footer = tags ? `${tags}` : '';
        const parts = [header];
        if (body && live_status !== 0) parts.push(body);
        if (footer && live_status !== 0) parts.push(footer);
        const formatted = parts.join('\n');

        if (live_status === 1) liveMessages.push(formatted);
        else if (live_status === 2) loopMessages.push(formatted);
        else offlineMessages.push(formatted);
    }

    // update last live statuses and persist
    const nextPrev: Record<string, number> = {};
    for (const k of Object.keys(cur)) {
        nextPrev[k] = Number(cur[k].live_status ?? cur[k].livestatus ?? 0);
    }
    try {
        await BLStore.setJson(KEY_LAST_INFO_STATUS, nextPrev);
    } catch (e) {
        console.log('getBLInfos: failed to write last statuses', String(e));
    }

    const ordered = [...liveMessages, ...loopMessages, ...offlineMessages];
    return ordered.length ? ordered.join('\n\n') : '';
}

async function getDYInfos(kv: KVNamespace): Promise<string> {
    // init KVStore
    const DYStore: KVStore = new KVStore(kv, 'DY');
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
    // will persist next statuses here
    const nextPrev: Record<string, number> = {};

    // fetch current live infos per sec_user_id
    for (const sec_user_id of sec_user_ids) {
        let apiResp: any;
        try {
            apiResp = await fetchDYLiveInfo(String(sec_user_id));
        } catch (e) {
            console.log('getDYInfos: fetch error', String(e));
            continue;
        }
        if (!apiResp || !apiResp.apisuccess || !apiResp.data) {
            console.log('getDYInfos: api fetch failed', apiResp);
            continue;
        }
        const cur: any = apiResp.data;
        // record current status for persistence
        nextPrev[String(sec_user_id)] = Number(cur.live_status ?? 0);
        // status changed -> prepare message
        const isLiveStatusChanged = Number(cur.live_status) !== Number(prev[String(sec_user_id)]);
        if (!isLiveStatusChanged) continue;
        const statusTexts: Record<number, string> = {
            0: '已下播',
            1: '*正在直播！*',
            2: '轮播中',
        };
        const statusText = statusTexts[Number(cur.live_status)] || `status: ${cur.live_status}`;
        const header = `${cur.nickname || ''} - ${statusText}`;
        const body = cur.title || '';
        const iplocation = cur.ip_location || '';
        const parts = [header];
        if (body) parts.push(body);
        if (iplocation && Number(cur.live_status) === 1) parts.push(iplocation);
        const formatted = parts.join('\n');
        if (Number(cur.live_status) === 1) liveMessages.push(formatted);
        else if (Number(cur.live_status) === 2) loopMessages.push(formatted);
        else offlineMessages.push(formatted);
    }

    // persist latest DY statuses
    try {
        await DYStore.setJson(KEY_LAST_INFO_STATUS, nextPrev);
    } catch (e) {
        console.log('getDYInfos: failed to write last statuses', String(e));
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
        dyMessages = await getDYInfos(kv);
    } catch (e) {
        console.log('runScheduledPush: getDYInfos error', String(e));
    }

    // combine messages into one and send: BL first (if any), then DY
    const finalText = ((blMessages ? `_Bilibili_\n${blMessages}` : '') + (dyMessages ? `_Douyin_\n${dyMessages}` : '')).trim();
    if (!finalText) {
        console.log('runScheduledPush: no status changes to send');
        return;
    }

    // send message
    try {
        await sendMessage(botToken, chatId, finalText);
        console.log('runScheduledPush: sent messages', { bl: !!blMessages, dy: !!dyMessages });
    } catch (e) {
        console.log('runScheduledPush: sendMessage failed', String(e));
    }
}
