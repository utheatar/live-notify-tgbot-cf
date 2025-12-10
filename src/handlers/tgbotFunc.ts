import { addToList, removeFromList, getList } from '../storage/kv';
import { sendMessage } from '../utils/telegram';

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

    if (cmd === 'add' && parts[1]) {
        await addToList(env.liveinfo, parts[1]);
        await sendMessage(env.BOT_TOKEN, chatId, `Added ${parts[1]}`);
        return new Response('added');
    }

    if (cmd === 'rm' && parts[1]) {
        await removeFromList(env.liveinfo, parts[1]);
        await sendMessage(env.BOT_TOKEN, chatId, `Removed ${parts[1]}`);
        return new Response('removed');
    }

    if (cmd === 'ls') {
        const list = await getList(env.liveinfo);
        const text = list.length ? list.join('\n') : '(empty)';
        await sendMessage(env.BOT_TOKEN, chatId, `List:\n${text}`);
        return new Response('listed');
    }

    await sendMessage(env.BOT_TOKEN, chatId, `Unknown command: ${cmd}`);
    return new Response('ok');
}
