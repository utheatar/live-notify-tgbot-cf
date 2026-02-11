import { runTask_BL } from './bilibili';
import { runTask_DY } from './douyin';

/**
 * Main scheduled runner.
 */
export async function runScheduledPush(env: Env) {
    const kv = env.live_notify_tgbot;
    const botToken = env.BOT_TOKEN;
    const chatId = env.CHAT_ID;

    // pre-checks
    if (!kv) {
        console.log('runScheduledPush: env.live_notify_tgbot not configured');
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

    // Run BL task
    try {
        const blResult = await runTask_BL(env);
        console.log('runScheduledPush BL:', blResult);
    } catch (e) {
        console.log('runScheduledPush: runTask_BL error', String(e));
    }

    // Run DY task
    try {
        const dyResult = await runTask_DY(env);
        console.log('runScheduledPush DY:', dyResult);
    } catch (e) {
        console.log('runScheduledPush: runTask_DY error', String(e));
    }
}
