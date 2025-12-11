import { getList, readByKey, writeKV } from '../storage/kv';
import { sendMessage } from '../utils/telegram';

const API_ENDPOINT = 'https://api-forwarding-vc.vercel.app/api/bili/liveinfos';

/**
 * Fetch liveinfos for given uids via GET (uids[] params)
 */
async function fetchLiveInfos(uids: string[] | number[]) {
    if (!uids || uids.length === 0) return null;
    // Use POST with JSON body to avoid excessively long URLs
    const url = API_ENDPOINT;
    const body = { uids: uids.map((u) => Number(u)) };
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`liveinfos fetch failed: ${resp.status}`);
    const json = await resp.json();
    return json;
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

    const uplist = await getList(kv);
    if (!uplist || uplist.length === 0) {
        console.log('runScheduledPush: uplist empty');
        return;
    }

    // fetch current live infos
    let apiResp: any;
    try {
        apiResp = await fetchLiveInfos(uplist);
    } catch (e) {
        console.log('runScheduledPush: fetch error', String(e));
        return;
    }

    if (!apiResp || !apiResp.apisuccess || !apiResp.data) {
        console.log('runScheduledPush: api fetch failed', apiResp);
        return;
    }

    const cur = apiResp.data;
    // read previous statuses (mapping uid -> live_status)
    let prev = (await readByKey(kv, 'last_live_infos')) || {};
    // const isFirstRun = !prev || Object.keys(prev).length === 0;
    const messages: string[] = [];
    for (const uidKey of Object.keys(cur)) {
        const info = cur[uidKey];
        if (!info) continue;
        // get fields
        const uid = String(info.uid ?? uidKey);
        const uname = info.uname ?? '';
        const title = info.title ?? '';
        const tags = info.tags ?? '';
        const live_status = Number(info.live_status ?? info.livestatus ?? 0);
        const room_id = info.room_id ?? info.roomid ?? 0;
        const live_time = Number(info.live_time ?? info.livetime ?? 0);

        const isLiveStatusChanged = Number(prev[uid]) !== live_status;

        // status changed -> prepare message
        if (isLiveStatusChanged) {
            const statusText = live_status == 1 ? '正在直播！' : '已下播';
            const header = `${uname}（${uid}）${statusText}`;
            const body = title ? `${title}` : '';
            const footer = tags ? `${tags}` : '';
            const parts = [header];
            if (body && live_status == 1) parts.push(body);
            if (footer && live_status == 1) parts.push(footer);
            messages.push(parts.join('\n'));
        }
    }

    // update last live statuses
    prev = {};
    for (const k of Object.keys(cur)) {
        prev[k] = cur[k].live_status;
    }

    // persist latest statuses
    try {
        await writeKV(kv, 'last_live_infos', prev);
    } catch (e) {
        console.log('runScheduledPush: failed to write last_live_infos', String(e));
    }

    if (messages.length === 0) {
        console.log('runScheduledPush: no status changes');
        return;
    }

    // combine messages into one and send
    const finalText = messages.join('\n\n');
    try {
        await sendMessage(botToken, chatId, finalText);
        console.log('runScheduledPush: sent messages', messages.length);
    } catch (e) {
        console.log('runScheduledPush: sendMessage failed', String(e));
    }
}
