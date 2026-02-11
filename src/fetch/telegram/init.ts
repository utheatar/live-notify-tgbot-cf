import { TelegramBot } from '../../platforms/telegram/bot';
import { COMMANDS } from './commands';
import { webhookPath } from '../router';

export async function handleInit(req: Request, env: Env) {
    if (!env.BOT_TOKEN || env.BOT_TOKEN.length === 0) return new Response(JSON.stringify({ error: 'BOT_TOKEN not set' }), { status: 500 });
    const botToken = env.BOT_TOKEN;

    const url = new URL(req.url);
    const origin = url.origin;
    const webhookUrl = `${origin}${webhookPath}`;

    const results: any = {};
    // include the calculated webhook URL in the response for visibility
    results.webhookUrl = webhookUrl;

    const bot = new TelegramBot(botToken);

    // Set webhook
    try {
        results.setWebhook = await bot.setWebhook(webhookUrl);
    } catch (e) {
        results.setWebhook = { error: String(e) };
    }
    // Set commands from centralized COMMANDS
    try {
        results.setCommands = await bot.setMyCommands(COMMANDS);
    } catch (e) {
        results.setCommands = { error: String(e) };
    }

    return new Response(JSON.stringify(results, null, 2), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleDeleteWebhook(req: Request, env: Env) {
    if (!env.BOT_TOKEN) return new Response('BOT_TOKEN missing', { status: 500 });
    const bot = new TelegramBot(env.BOT_TOKEN);
    const result = await bot.deleteWebhook();
    return new Response(JSON.stringify(result, null, 2), { headers: { 'Content-Type': 'application/json' } });
}