import { Hono } from 'hono';
import { handleRoot } from './telegram/root';
import { handleInit, handleDeleteWebhook } from './telegram/init';
import { handleTgWebhook } from './telegram/commandHandler';
import API_TEST_HTML from '../templates/api-test.html';

export const webhookPath = '/tgbot/webhook';

const app = new Hono<{ Bindings: Env }>();

// API 测试页面
app.get('/', (c) => {
    return c.html(API_TEST_HTML);
});
app.get('/index.html', (c) => {
    return c.html(API_TEST_HTML);
});
app.get('/api-test', (c) => {
    return c.html(API_TEST_HTML);
});
app.get('/api-test.html', (c) => {
    return c.html(API_TEST_HTML);
});

// Telegram Bot Handlers
app.get('/tgbot', async (c) => {
    return await handleRoot(c.req.raw, c.env);
});

app.get('/tgbot/init', async (c) => {
    return await handleInit(c.req.raw, c.env);
});

app.get('/tgbot/uninit', async (c) => {
    return await handleDeleteWebhook(c.req.raw, c.env);
});

app.post(webhookPath, async (c) => {
    return await handleTgWebhook(c.req.raw, c.env);
});

// 404 Handler
app.notFound((c) => {
    return c.text('Not Found such path ' + c.req.path, 404);
});

// Error Handler
app.onError((err, c) => {
    return c.text(String(err), 500);
});

export default app;
