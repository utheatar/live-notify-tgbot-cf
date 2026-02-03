import { sendMessage } from '../utils/telegram';
import { KVStore } from '../storage/KVStore';
import { fetchLiveInfosVC } from '../utils/bilibili';
import { getDYUserInfo } from '../utils/douyin';
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
import { DYUser } from '../datamodel/DY';


export async function handleTgWebhook(req: Request, env: Env) {
    if (req.method === 'OPTIONS') return new Response('Method OPTIONS OK', { status: 200 });

    // parse request body
    let body: any;
    try {
        body = await req.json();
    } catch (e) {
        return new Response('invalid json from request body', { status: 400 });
    }

    // extract message
    const msg = body.message || body.edited_message || body.channel_post;
    if (!msg) return new Response('no message', { status: 200 });
    // extract text and chat id
    const text: string = (msg.text || '').trim();
    const chatId = msg.chat && msg.chat.id;
    // handle only text messages
    if (!text.startsWith('/')) {
        await handleTgNormalMessage();
    } else {
        await handleTgCommand(text, env);
    }

    return new Response('ok');
}

async function handleTgNormalMessage() {
    // Optional: implement handling of normal (non-command) messages if needed
}

async function handleTgCommand(text: string, env: Env): Promise<Response> {
    // prepare env vars
    const bot_token = env.BOT_TOKEN;
    const chatId = env.CHAT_ID;
    const dy_cookie = env.DY_COOKIE1;
    const user_agent = env.USER_AGENT;
    // check essential env vars
    if (!bot_token || bot_token.length === 0) {
        console.error('BOT_TOKEN is not configured.');
        return new Response('BOT_TOKEN not configured', { status: 500 });
    }
    if (!chatId || chatId.length === 0) {
        console.error('CHAT_ID is not configured.');
        return new Response('CHAT_ID not configured', { status: 500 });
    }
    if (!dy_cookie || dy_cookie.length === 0) {
        console.error('DY_COOKIE1 is not configured.');
        return new Response('DY_COOKIE1 not configured', { status: 500 });
    }
    if (!user_agent || user_agent.length === 0) {
        await sendMessage(bot_token, chatId, 'USER_AGENT is not configured.');
        console.error('USER_AGENT is not configured.');
        return new Response('USER_AGENT not configured', { status: 500 });
    }

    // init KVStores and databases
    const BLStore = new KVStore(env.liveinfo, 'BL');
    const DYStore = new KVStore(env.liveinfo, 'DY');

    // handle command: parse command
    const parts = text.split(/\s+/);
    const cmd = parts[0].slice(1).toLowerCase();

    if (cmd === COMMAND_ADD_BLUSER) {
        // check uid arg
        if (!parts[1] || parts[1].length === 0) {
            await sendMessage(env.BOT_TOKEN, chatId, 'Please provide a UID to add.');
            console.log('no uid provided.');
            return new Response('no uid', { status: 200 });
        }
        const uid = parts[1];
        // try to get uname for better feedback
        let uname = '';
        try {
            const infoResp: any = await fetchLiveInfosVC([uid]);
            if (infoResp && infoResp.apisuccess && infoResp.data) {
                const entry = infoResp.data[String(uid)] || infoResp.data[Number(uid)];
                uname = entry && entry.uname ? entry.uname : '';
            }
        } catch (e) {
            console.error('fetch uname error', String(e));
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
            const infoResp: any = await fetchLiveInfosVC([uid]);
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
            infoResp = await fetchLiveInfosVC(list);
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

    // DY commands (Douyin)
    if (cmd === COMMAND_ADD_DYUSER) {
        if (!parts[1] || parts[1].length === 0) {
            await sendMessage(env.BOT_TOKEN, chatId, 'Please provide a sec_user_id to add.');
            return new Response('no uid', { status: 200 });
        }
        const sec = parts[1];
        let nickname = '';
        try {
            const resp: any = await getDYUserInfo(sec, dy_cookie, user_agent);
            if (resp && resp.sec_uid && resp.nickname) {
                const entry = resp;
                nickname = entry.nickname ?? entry?.uname ?? entry?.unique_id ?? 'undefined';
            } else {
                await sendMessage(env.BOT_TOKEN, chatId, 'Douyin user not found.');
                throw new Error('Douyin user not found');
            }
        } catch (e) {
            console.error('dy fetch nickname error', String(e));
        }

        const key = KEY_USERLIST;
        const raw = (await DYStore.getJson<string[]>(key)) || [];
        const list2 = Array.isArray(raw) ? raw : [];
        if (!list2.includes(sec)) {
            list2.push(sec);
            await DYStore.setJson(key, list2);
        }
        const display = nickname ? `${sec}->${nickname}` : String(sec);
        await sendMessage(env.BOT_TOKEN, chatId, `Added ${display}`);
        return new Response('added');
    }

    if (cmd === COMMAND_REMOVE_DYUSER) {
        if (!parts[1] || parts[1].length === 0) {
            await sendMessage(env.BOT_TOKEN, chatId, 'Please provide a sec_user_id to remove.');
            return new Response('no uid', { status: 200 });
        }
        const sec = parts[1];
        let nickname = '';
        try {
            const resp: any = await getDYUserInfo(sec, env.DY_COOKIE1, env.USER_AGENT);
            if (resp && resp.sec_uid && resp.nickname) {
                const entry = resp;
                nickname = entry.nickname ?? entry?.uname ?? entry?.unique_id ?? '';
            } else {
                await sendMessage(env.BOT_TOKEN, chatId, 'Douyin user not found.');
                throw new Error('Douyin user not found');
            }
        } catch (e) {
            console.error('dy fetch nickname error', String(e));
        }

        const key = KEY_USERLIST;
        const raw = (await DYStore.getJson<string[]>(key)) || [];
        const list2 = Array.isArray(raw) ? raw : [];
        const idx = list2.indexOf(sec);
        if (idx !== -1) {
            list2.splice(idx, 1);
            await DYStore.setJson(key, list2);
        }
        const display = nickname ? `${sec}->${nickname}` : String(sec);
        await sendMessage(env.BOT_TOKEN, chatId, `Removed ${display}`);
        return new Response('removed');
    }

    if (cmd === COMMAND_LIST_DYUSER) {
        const key = KEY_USERLIST;
        const raw = (await DYStore.getJson<string[]>(key)) || [];
        const list2 = Array.isArray(raw) ? raw : [];
        if (!list2 || list2.length === 0) {
            await sendMessage(env.BOT_TOKEN, chatId, '(empty)');
            return new Response('listed');
        }

        for (const sec of list2) {
            let nickname = '';
            try {
                const infoRespDy: any = await getDYUserInfo(sec, env.DY_COOKIE1, env.USER_AGENT);
                if (infoRespDy && infoRespDy.sec_uid && infoRespDy.nickname) {
                    const entry = infoRespDy;
                    nickname = entry.nickname ?? entry?.uname ?? entry?.unique_id ?? '';
                } else {
                    nickname = 'undefined';
                }
            } catch (e) {
                console.error('dy fetch nickname error', String(e));
            }
            const display = nickname ? `${sec}->${nickname}` : String(sec);
            await sendMessage(env.BOT_TOKEN, chatId, display);
        }
        return new Response('listed');
    }

    // unknown command
    await sendMessage(env.BOT_TOKEN, chatId, `Unknown command: ${cmd}`);
    return new Response('unknown command', { status: 200 });
}
