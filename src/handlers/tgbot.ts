import { getWebhookInfo } from '../utils/telegram';

export async function handleRoot(req: Request, env: Env) {
    const botToken = env.BOT_TOKEN;
    let info: any = { error: 'BOT_TOKEN not configured' };
    if (botToken) {
        try {
            info = await getWebhookInfo(botToken);
        } catch (e) {
            info = { error: String(e) };
        }
    }

    const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>tgbot-pusher2</title></head>
  <body>
    <h1>tgbot-pusher2</h1>
    <p>Bot webhook info:</p>
    <pre>${JSON.stringify(info, null, 2)}</pre>
        <p><a href="/tgbot/init">Init (set webhook & commands)</a></p>
  </body>
</html>`;

    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
