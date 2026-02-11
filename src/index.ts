import app from './fetch/router';
import { runScheduledPush } from './scheduled/main';

export default {
	fetch: app.fetch,
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		try {
			await runScheduledPush(env);
		} catch (e) {
			console.log('scheduled handler error', String(e));
		}
	},
} satisfies ExportedHandler<Env>;
