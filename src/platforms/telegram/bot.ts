export interface TelegramBotCommand {
    command: string;
    description: string;
}

export class TelegramBot {
    private readonly token: string;
    private readonly apiBase: string;

    constructor(token: string) {
        this.token = token;
        this.apiBase = `https://api.telegram.org/bot${token}`;
    }

    private async callApi(method: string, body?: any): Promise<any> {
        const url = `${this.apiBase}/${method}`;
        const init: RequestInit = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        };
        if (body) {
            init.body = JSON.stringify(body);
        }
        const res = await fetch(url, init);
        return res.json();
    }

    /**
     * Get current webhook status
     */
    async getWebhookInfo() {
        // getWebhookInfo usually doesn't need a body, but can take one. 
        // passing empty body or GET is fine, but POST is standard for all TG methods.
        return this.callApi('getWebhookInfo');
    }

    /**
     * Set webhook URL
     * @param url Webhook URL
     */
    async setWebhook(url: string) {
        return this.callApi('setWebhook', { url, drop_pending_updates: true });
    }

    /**
     * Delete webhook
     */
    async deleteWebhook() {
        return this.callApi('deleteWebhook', { drop_pending_updates: true });
    }

    /**
     * Set bot commands
     * @param commands List of commands
     */
    async setMyCommands(commands: TelegramBotCommand[]) {
        return this.callApi('setMyCommands', { commands });
    }

    /**
     * Send a text message
     * @param chatId Target chat ID
     * @param text Message text
     * @param parseMode Parse mode (Markdown, HTML, etc.)
     */
    async sendMessage(chatId: number | string, text: string, parseMode: string = '') {
        return this.callApi('sendMessage', {
            chat_id: chatId,
            text,
            parse_mode: parseMode
        });
    }
}
