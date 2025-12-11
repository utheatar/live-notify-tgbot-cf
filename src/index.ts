/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your Worker in action
 * - Run `npm run deploy` to publish your Worker
 *
 * Bind resources to your Worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { handleRoot } from './handlers/tgbot';
import { handleInit } from './handlers/tgbotInit';
import { handleTgWebhook } from './handlers/tgbotFunc';
import { runScheduledPush } from './pusher/scheduledPush';

export default {
	async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(req.url);
		const pathname = url.pathname || '/';

		try {
			if (pathname === '/tgbot') return handleRoot(req, env);
			if (pathname === '/tgbot/init') return handleInit(req, env);
			if (pathname === '/tgbot/func') return handleTgWebhook(req, env);

			return new Response('Not Found such path ' + pathname, { status: 404 });
		} catch (e) {
			return new Response(String(e), { status: 500 });
		}
	},

	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(`scheduled trigger fired at ${controller.scheduledTime}`);
		try {
			await runScheduledPush(env);
		} catch (e) {
			console.log('scheduled handler error', String(e));
		}
	},
} satisfies ExportedHandler<Env>;
