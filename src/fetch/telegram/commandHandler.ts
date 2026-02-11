import { TelegramBot } from '../../platforms/telegram/bot';
import { KVStore } from '../../storage/KVStore';
import { BLStreamerBaseItem } from '../../platforms/bilibili/aggregation';
import { getDYUserInfo } from '../../platforms/douyin/api';
import {
    COMMAND_LIST_ALLUSER,
    COMMAND_ADD_DYUSER,
    COMMAND_REMOVE_DYUSER,
    COMMAND_LIST_DYUSER,
    COMMAND_BL_ADD_STREAMER,
    COMMAND_BL_REMOVE_STREAMER,
    COMMAND_BL_LIST_STREAMER
} from './commands';
import { KEY_UID_ROOMID, KEY_USERLIST } from '../../constants/KVstoreKey';
import { DYUser } from '../../storage/DY';
import { fetchLiveStatusByUids } from '../../platforms/bilibili/liveStatusByUids';


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
    try {
        if (!text.startsWith('/')) {
            await handleTgNormalMessage();
        } else {
            await handleTgCommand(text, env, chatId);
        }
    } catch (e) {
        console.error('handleTgWebhook error:', e);
        try {
            const bot = new TelegramBot(env.BOT_TOKEN);
            await bot.sendMessage(chatId, `❌ Internal Error: ${String(e)}`);
        } catch (sendErr) {
            console.error('Failed to send error report:', sendErr);
        }
    }

    return new Response('ok');
}

async function handleTgNormalMessage() {
    // Optional: implement handling of normal (non-command) messages if needed
}

async function handleTgCommand(text: string, env: Env, chatId: number | string): Promise<Response> {
    // prepare env vars
    const bot_token = env.BOT_TOKEN;
    const dy_cookie = env.DY_COOKIE1;
    const user_agent = env.USER_AGENT;

    const bot = new TelegramBot(bot_token);

    // check essential env vars
    if (!bot_token || bot_token.length === 0) {
        console.error('BOT_TOKEN is not configured.');
        return new Response('BOT_TOKEN not configured', { status: 500 });
    }
    if (!chatId || (typeof chatId === 'string' && chatId.length === 0)) {
        console.error('CHAT_ID is not configured.');
        return new Response('CHAT_ID not configured', { status: 500 });
    }
    if (!dy_cookie || dy_cookie.length === 0) {
        await bot.sendMessage(chatId, 'DY_COOKIE1 is not configured.');
        console.error('DY_COOKIE1 is not configured.');
        return new Response('DY_COOKIE1 not configured', { status: 500 });
    }
    if (!user_agent || user_agent.length === 0) {
        await bot.sendMessage(chatId, 'USER_AGENT is not configured.');
        console.error('USER_AGENT is not configured.');
        return new Response('USER_AGENT not configured', { status: 500 });
    }

    // init KVStores and databases
    const BLStore = new KVStore(env.live_notify_tgbot, 'BL');
    const DYStore = new KVStore(env.live_notify_tgbot, 'DY');

    // handle command: parse command
    const parts = text.split(/\s+/);
    const cmd = parts[0].slice(1).toLowerCase();
    const args = parts[1] ? parts[1].split(',') : [];

    // DY commands (Douyin)
    if (cmd === COMMAND_ADD_DYUSER) {
        if (!parts[1] || parts[1].length === 0) {
            await bot.sendMessage(chatId, 'Please provide a sec_user_id to add.');
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
                await bot.sendMessage(chatId, 'Douyin user not found.');
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
        await bot.sendMessage(chatId, `Added ${display}`);
        return new Response('added');
    }

    if (cmd === COMMAND_REMOVE_DYUSER) {
        if (!parts[1] || parts[1].length === 0) {
            await bot.sendMessage(chatId, 'Please provide a sec_user_id to remove.');
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
                await bot.sendMessage(chatId, 'Douyin user not found.');
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
        await bot.sendMessage(chatId, `Removed ${display}`);
        return new Response('removed');
    }

    if (cmd === COMMAND_LIST_DYUSER) {
        const key = KEY_USERLIST;
        const raw = (await DYStore.getJson<string[]>(key)) || [];
        const list2 = Array.isArray(raw) ? raw : [];
        if (!list2 || list2.length === 0) {
            await bot.sendMessage(chatId, '(empty)');
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
            await bot.sendMessage(chatId, display);
        }
        return new Response('listed');
    }

    if (cmd === COMMAND_BL_ADD_STREAMER) {
        // 1. 参数检查
        if (args.length === 0 || args[0] === '') {
            await bot.sendMessage(chatId, '请提供要添加的 UID，例如: /bladd 12345 或 /bladd 123,456');
            console.log('no uid provided.');
            return new Response('no uid', { status: 200 });
        }
        // 过滤掉空的 uid 并去重
        const inputUids = [...new Set(args.filter(u => u.trim().length > 0))];

        // 计数器与名单
        let addCount = 0;
        let updateCount = 0;
        const addedNames: string[] = [];
        const updatedNames: string[] = [];
        const failedUids: string[] = [];

        try {
            // 2. 调用 B站 API 获取直播间信息 (批量)
            const liveStatusBatch = await fetchLiveStatusByUids(inputUids);

            // 3. 读取 KV 中现有的列表
            const key = KEY_UID_ROOMID;
            const currentList = (await BLStore.getJson<BLStreamerBaseItem[]>(key)) || [];

            let hasChange = false;

            // 4. 遍历 API 返回的结果并处理 (新增或更新)
            for (const uidStr of inputUids) {
                const uidNum = Number(uidStr);
                const info = liveStatusBatch[uidNum];

                if (info) {
                    // 查找 KV 中是否已存在该 UID
                    const existingIndex = currentList.findIndex(item => item.uid === uidNum);

                    if (existingIndex === -1) {
                        // --- 情况 A: 不存在 -> 新增 ---
                        currentList.push({
                            uid: info.uid,
                            roomid: info.room_id,
                            name: info.uname
                        });
                        hasChange = true;
                        addCount++;
                        addedNames.push(`${info.uname}(${info.uid})`);
                    } else {
                        // --- 情况 B: 已存在 -> 更新 ---
                        // 无论数据是否变化，都进行覆盖更新，确保名字和房间号是最新的
                        currentList[existingIndex] = {
                            uid: info.uid,
                            roomid: info.room_id,
                            name: info.uname
                        };
                        hasChange = true;
                        updateCount++;
                        updatedNames.push(`${info.uname}(${info.uid})`);
                    }
                } else {
                    // API 没返回这个 UID 的信息，可能是无效 UID
                    failedUids.push(`${uidStr}(无效)`);
                }
            }

            // 5. 如果有变动 (新增或更新)，写入 KV
            if (hasChange) {
                await BLStore.setJson(key, currentList);
            }

            // 6. 发送反馈消息 (区分新增和更新)
            let replyMsg = '';
            if (addCount > 0) {
                replyMsg += `✅ 新增 ${addCount} 人:\n${addedNames.join(', ')}\n`;
            }
            if (updateCount > 0) {
                replyMsg += `🔄 更新 ${updateCount} 人:\n${updatedNames.join(', ')}\n`;
            }
            if (failedUids.length > 0) {
                replyMsg += `⚠️ 失败 (无效UID):\n${failedUids.join(', ')}`;
            }

            if (!replyMsg) replyMsg = '未执行任何操作';

            await bot.sendMessage(chatId, replyMsg);

        } catch (e) {
            console.error('Add/Update BLUser error:', e);
            await bot.sendMessage(chatId, `操作失败: 内部错误 - ${String(e)}`);
        }

        return new Response('command processed', { status: 200 });
    }

    if (cmd === COMMAND_BL_REMOVE_STREAMER) {
        if (args.length === 0 || args[0] === '') {
            await bot.sendMessage(chatId, '请提供要删除的 UID，例如: /blrm 12345 或 /blrm 123,456');
            return new Response('no uid', { status: 200 });
        }

        // 2. 转换并清洗 UID (去重、转数字)
        const inputUidsStr = [...new Set(args.filter(u => u.trim().length > 0))];
        const inputUids = inputUidsStr.map(u => Number(u)).filter(n => !isNaN(n));

        if (inputUids.length === 0) {
            await bot.sendMessage(chatId, '提供的 UID 格式不正确');
            return new Response('invalid uid', { status: 200 });
        }

        try {
            const key = KEY_UID_ROOMID;
            // 读取当前列表
            const currentList = (await BLStore.getJson<BLStreamerBaseItem[]>(key)) || [];

            // 准备删除逻辑
            const uidsToRemoveSet = new Set(inputUids);
            const newList: BLStreamerBaseItem[] = [];
            const removedUidSet = new Set<number>(); // 用于记录实际成功删除的UID
            const removedNames: string[] = [];

            // 3. 遍历现有列表，保留不需要删除的
            for (const item of currentList) {
                if (uidsToRemoveSet.has(item.uid)) {
                    // 命中删除
                    removedUidSet.add(item.uid);
                    removedNames.push(`${item.name}(${item.uid})`);
                } else {
                    // 保留
                    newList.push(item);
                }
            }

            // 计算未找到的 UID
            const notFoundUids = inputUids.filter(uid => !removedUidSet.has(uid));

            // 4. 如果有变动，写入 KV
            if (removedUidSet.size > 0) {
                await BLStore.setJson(key, newList);
            }

            // 5. 构建反馈消息
            let replyMsg = '';
            if (removedUidSet.size > 0) {
                replyMsg += `🗑️ 已删除 ${removedUidSet.size} 人:\n${removedNames.join(', ')}\n`;
            }
            if (notFoundUids.length > 0) {
                replyMsg += `⚠️ 未找到 (列表里没有):\n${notFoundUids.join(', ')}`;
            }

            if (!replyMsg) replyMsg = '未执行任何操作';

            await bot.sendMessage(chatId, replyMsg);

        } catch (e) {
            console.error('Remove BLUser error:', e);
            await bot.sendMessage(chatId, `删除失败: 内部错误 - ${String(e)}`);
        }

        return new Response('command processed', { status: 200 });
    }

    if (cmd === COMMAND_BL_LIST_STREAMER) {
        const key = KEY_UID_ROOMID;
        try {
            // 读取 KV 列表
            const list = (await BLStore.getJson<BLStreamerBaseItem[]>(key)) || [];

            // 1. 判空处理
            if (list.length === 0) {
                await bot.sendMessage(chatId, '📋 列表为空\n你可以使用 /bladd 添加主播');
                return new Response('empty list', { status: 200 });
            }

            // 2. 格式化输出: name (uid)
            // 这里我加了一个标题头，让消息看起来更整洁
            const lines = list.map(item => `${item.name} (${item.uid})`);
            const message = `📋 已监控主播 (${list.length}):\n\n` + lines.join('\n');

            // 3. 发送消息
            await bot.sendMessage(chatId, message);

        } catch (e) {
            console.error('List BLUser error:', e);
            await bot.sendMessage(chatId, `获取列表失败: 内部错误 - ${String(e)}`);
        }

        return new Response('list command processed', { status: 200 });
    }

    if (cmd === 'start' || cmd === 'help') {
        const helpMsg = `Available commands:
/bladd <uid> - Add Bilibili streamer
/blrm <uid> - Remove Bilibili streamer
/blls - List Bilibili streamers
/adddy <sec_uid> - Add Douyin user
/rmdy <sec_uid> - Remove Douyin user
/lsdy - List Douyin users
/lsall - List all
`;
        await bot.sendMessage(chatId, helpMsg);
        return new Response('help sent', { status: 200 });
    }

    // unknown command
    await bot.sendMessage(chatId, `Unknown command: ${cmd}`);
    return new Response('unknown command', { status: 200 });
}
