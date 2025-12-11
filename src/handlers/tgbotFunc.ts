import { sendMessage } from '../utils/telegram';
import { KVStore } from '../storage/KVStore';
import { fetchLiveInfos } from '../utils/bilibili';
import {
    COMMAND_LIST_ALLUSER,
    COMMAND_ADD_BLUSER,
    COMMAND_REMOVE_BLUSER,
    COMMAND_LIST_BLUSER,
    COMMAND_ADD_DYUSER,
    COMMAND_REMOVE_DYUSER,
    COMMAND_LIST_DYUSER,
} from '../constants/commands';
import { KEY_USERLIST, KEY_LAST_INFO_STATUS } from '../storage/KVStore';


export async function handleTgWebhook(req: Request, env: Env) {
    if (req.method === 'OPTIONS') return new Response('Method OPTIONS OK', { status: 200 });

    let body: any;
    try {
        body = await req.json();
    } catch (e) {
        return new Response('invalid json', { status: 400 });
    }

    const msg = body.message || body.edited_message || body.channel_post;
    if (!msg) return new Response('no message', { status: 200 });

    const text: string = (msg.text || '').trim();
    const chatId = msg.chat && msg.chat.id;

    if (!text.startsWith('/')) {
        // TODO: handle non-command messages if needed
        return new Response('no command', { status: 200 });
    }

    const parts = text.split(/\s+/);
    const cmd = parts[0].slice(1).toLowerCase();

    const BLStore = new KVStore(env.liveinfo, 'BL');
    const DYStore = new KVStore(env.liveinfo, 'DY');

    if (cmd === COMMAND_ADD_BLUSER) {
        if (!parts[1] || parts[1].length === 0) {
            await sendMessage(env.BOT_TOKEN, chatId, 'Please provide a UID to add.');
            return new Response('no uid', { status: 200 });
        }
        const uid = parts[1];
        // try to get uname for better feedback
        let uname = '';
        try {
            const infoResp: any = await fetchLiveInfos([uid]);
            if (infoResp && infoResp.apisuccess && infoResp.data) {
                const entry = infoResp.data[String(uid)] || infoResp.data[Number(uid)];
                uname = entry && entry.uname ? entry.uname : '';
            }
        } catch (e) {
            console.log('fetch uname error', String(e));
        }

        const key = KEY_USERLIST;
        const raw = (await BLStore.getJson<string[]>(key)) || [];
        const list = Array.isArray(raw) ? raw : [];
        if (!list.includes(uid)) {
            list.push(uid);
            await BLStore.setJson(key, list);
        }
        const display = uname ? `${uid}->${uname}` : String(uid);
        await sendMessage(env.BOT_TOKEN, chatId, `Added ${display}`);
        return new Response('added');
    }

    if (cmd === COMMAND_REMOVE_BLUSER) {
        if (!parts[1] || parts[1].length === 0) {
            await sendMessage(env.BOT_TOKEN, chatId, 'Please provide a UID to remove.');
            return new Response('no uid', { status: 200 });
        }
        const uid = parts[1];
        // try to fetch uname
        let uname = '';
        try {
            const infoResp: any = await fetchLiveInfos([uid]);
            if (infoResp && infoResp.apisuccess && infoResp.data) {
                const entry = infoResp.data[String(uid)] || infoResp.data[Number(uid)];
                uname = entry && entry.uname ? entry.uname : '';
            }
        } catch (e) {
            console.log('fetch uname error', String(e));
        }

        const key = KEY_USERLIST;
        const raw = (await BLStore.getJson<string[]>(key)) || [];
        const list = Array.isArray(raw) ? raw : [];
        const idx = list.indexOf(uid);
        if (idx !== -1) {
            list.splice(idx, 1);
            await BLStore.setJson(key, list);
        }
        const display = uname ? `${uid}->${uname}` : String(uid);
        await sendMessage(env.BOT_TOKEN, chatId, `Removed ${display}`);
        return new Response('removed');
    }

    if (cmd === COMMAND_LIST_BLUSER) {
        const key = KEY_USERLIST;
        const raw = (await BLStore.getJson<string[]>(key)) || [];
        const list = Array.isArray(raw) ? raw : [];
        if (!list || list.length === 0) {
            await sendMessage(env.BOT_TOKEN, chatId, '(empty)');
            return new Response('listed');
        }

        // fetch names in batch
        let infoResp: any = null;
        try {
            infoResp = await fetchLiveInfos(list);
        } catch (e) {
            console.log('fetch list unames error', String(e));
        }

        for (const uid of list) {
            let uname = '';
            if (infoResp && infoResp.apisuccess && infoResp.data) {
                const entry = infoResp.data[String(uid)] || infoResp.data[Number(uid)];
                uname = entry && entry.uname ? entry.uname : '';
            }
            const display = uname ? `${uid}->${uname}` : String(uid);
            await sendMessage(env.BOT_TOKEN, chatId, display);
        }
        return new Response('listed');
    }

    await sendMessage(env.BOT_TOKEN, chatId, `Unknown command: ${cmd}`);
    return new Response('ok');
}
