# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

```bash
# Development
npm run dev      # Start local dev server with scheduled trigger emulation (--test-scheduled)
npm run start    # Alias for dev

# Deployment
npm run deploy   # Deploy to Cloudflare Workers

# TypeScript types (after modifying wrangler.jsonc bindings)
npm run cf-typegen  # Regenerate worker-configuration.d.ts from wrangler.jsonc
```

## Architecture Overview

This is a Cloudflare Worker for a Telegram bot that tracks live status changes for Bilibili and Douyin streamers. The worker runs on a 1-minute cron schedule and sends notifications when detected status changes occur.

### Request Flow

**HTTP Routes** (`src/index.ts`):
- `GET /tgbot` → Welcome page, shows webhook info
- `GET /tgbot/init` → Initializes Telegram webhook and bot commands
- `POST /tgbot/func` → Telegram webhook handler, processes slash commands
- `/` or `/api-test` → API test page (HTML template)

**Scheduled** (`src/pusher/scheduledPush.ts`):
- Cron trigger → `runScheduledPush()` → fetches live info from both platforms → compares with KV-stored last statuses → sends Telegram message on change

### Storage Architecture

**KV Namespace (`liveinfo`)**: Uses a single KV namespace with key prefixes for platform isolation:
- **Prefix `BL`** for Bilibili, **Prefix `DY`** for Douyin
- Keys constructed as `<PREFIX>_<KEY>` by `KVStore` class

**Key Pattern**:
- `<PREFIX>_userlist` - Array of tracked user IDs (`uid` for Bilibili, `sec_user_id` for Douyin)
- `<PREFIX>_last_info_status` - Map of `user_id → live_status` (number) for change detection

**KVStore** (`src/storage/KVStore.ts`): Wrapper class providing typed JSON access (`getJson<T>`, `setJson<T>`) and automatic key prefixing. Always use this instead of raw KV access for consistency.

### Platform-Specific Fetching

**Bilibili** (`src/utils/bilibili.ts`):
- Batch fetch via `fetchLiveInfos(userlist)` - accepts array of uids
- Returns mapped response with `uid` as keys

**Douyin** (`src/utils/douyin.ts`):
- Per-user fetch via `fetchDYLiveInfo(sec_user_id)` - the forwarding API doesn't support batch
- Fetched sequentially in the scheduled loop

### Live Status Values

| Status | Meaning |
|--------|---------|
| 0 | Offline (已下播) |
| 1 | Live (*正在直播！*) |
| 2 | Replay/Loop (轮播中) |

## Environment Bindings

Required bindings in `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [
    { "binding": "liveinfo", "id": "..." }
  ],
  "d1_databases": [
    { "binding": "streamers", "database_id": "..." }
  ],
  "vars": {
    "BOT_TOKEN": "...",    // Telegram bot token (secret)
    "CHAT_ID": "..."       // Target chat for notifications
  }
}
```

**`Env` interface** (from `worker-configuration.d.ts`):
- `env.liveinfo: KVNamespace` - User lists and status tracking
- `env.streamers: D1Database` - Streamer metadata (not currently used)
- `env.BOT_TOKEN: string` - Telegram bot API token
- `env.CHAT_ID: string` - Telegram chat ID for push notifications

**Important**: After adding or modifying bindings in `wrangler.jsonc`, run `npm run cf-typegen` to regenerate `worker-configuration.d.ts`.

## Telegram Commands

Commands are defined in `src/constants/commands.ts`:
- `/add_bluser <uid>` - Add Bilibili user
- `/rm_bluser <uid>` - Remove Bilibili user
- `/ls_bluser` - List Bilibili users
- `/add_dyuser <sec_user_id>` - Add Douyin user
- `/rm_dyuser <sec_user_id>` - Remove Douyin user
- `/ls_dyuser` - List Douyin users
- `/ls_alluser` - List all tracked users

Command handling in `src/handlers/tgbotFunc.ts` parses messages and manages KV user lists.

## HTML Templates

Templates are in `src/templates/`:
- `api-test.html` - API testing interface (exported as default import in `src/index.ts`)
- `welcome.html` - Simple welcome page
- `html.d.ts` - TypeScript declaration for importing HTML as strings

## Notes

- The scheduled push currently has Douyin fetching commented out in `runScheduledPush()` (lines 200-207) - only Bilibili is active
- KV writes are minimized: status mapping only updated when `changedCount > 0`
- Message format uses Markdown-style bold (`*text*`) for emphasis
- Error logging uses `console.log` for Cloudflare Workers observability
