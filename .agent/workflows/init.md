---
description: Initialize and understand the live-notify-tgbot-cf project
---

# Project Initialization Workflow

This workflow helps you understand and get started with the **tgbot-pusher2** project - a Cloudflare Worker Telegram bot for monitoring Bilibili and Douyin streamer live status.

## Project Overview

- **Stack**: Cloudflare Workers, TypeScript, KV Storage, D1 Database
- **Purpose**: Monitor streamers' live status, push notifications to Telegram
- **Trigger**: 1-minute cron schedule + Telegram webhook commands

## Key Files to Review

| File | Purpose |
|------|---------|
| `CLAUDE.md` | AI assistant context and architecture overview |
| `README.md` | Full project documentation (Chinese) |
| `wrangler.jsonc` | Cloudflare Worker configuration |
| `src/index.ts` | Entry point, HTTP routes |
| `src/pusher/scheduledPush.ts` | Cron job logic |
| `src/handlers/tgbotFunc.ts` | Telegram command handling |

## Common Commands

```bash
# Install dependencies
npm install

# Start local dev server (with scheduled trigger emulation)
npm run dev

# Deploy to Cloudflare Workers
npm run deploy

# Regenerate TypeScript types after modifying wrangler.jsonc
npm run cf-typegen
```

## Storage Architecture

- **KV (`liveinfo`)**: User lists and last status tracking with `BL_`/`DY_` prefixes
- **D1 (`streamers`)**: Status change history records

## Live Status Values

| Status | Meaning |
|--------|---------|
| 0 | Offline (已下播) |
| 1 | Live (正在直播) |
| 2 | Replay/Loop (轮播中) |

## Environment Secrets (via `wrangler secret put`)

- `BOT_TOKEN` - Telegram bot token
- `CHAT_ID` - Target chat ID for notifications
- `DY_COOKIE1` - Douyin API cookie (if using Douyin features)
