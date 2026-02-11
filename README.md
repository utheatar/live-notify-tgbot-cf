# live-notify-tgbot-cf

基于 Cloudflare Worker 的 Telegram 机器人，用于监控 Bilibili 和抖音（Douyin）主播的直播状态，当检测到状态变化时推送通知到指定 Telegram 群组。

## 功能概述

- **直播状态监控**：定时（默认每分钟）检查 Bilibili 和抖音主播的直播状态
- **状态变化通知**：当主播的直播状态发生变化（开播、下播、轮播）时，自动发送 Telegram 消息通知
- **数据持久化**：直播期间每分钟将状态数据写入 Cloudflare D1 数据库
- **用户管理**：通过 Telegram 命令添加/删除/查看被监控的主播列表
- **API 测试页面**：提供 Web 界面进行 API 测试

## 项目架构

### 目录结构

```
src/
├── index.ts                # Worker 入口，注册 fetch 和 scheduled 处理器
├── fetch/                  # HTTP 请求处理
│   ├── router.ts             # Hono 路由定义
│   └── telegram/             # Telegram Bot 相关
│       ├── commands.ts         # 命令常量与命令列表
│       ├── commandHandler.ts   # Webhook 处理、命令解析与分发
│       ├── init.ts             # Webhook 初始化与删除
│       └── root.ts             # /tgbot 信息页
├── scheduled/              # 定时任务
│   ├── main.ts               # 定时任务入口/协调器
│   ├── bilibili.ts           # Bilibili 直播状态检查与推送
│   └── douyin.ts             # 抖音直播状态检查与推送
├── platforms/              # 第三方平台 API 封装
│   ├── bilibili/             # Bilibili API
│   │   ├── aggregation.ts      # 批量状态聚合查询（核心）
│   │   ├── roomInfoByRoomids.ts# 房间基础信息批量获取
│   │   ├── guardInfo.ts        # 舰长信息
│   │   ├── roomAudienceRank.ts # 高能榜/在线观众
│   │   ├── userspace.ts        # 用户空间信息
│   │   ├── liveStatusByUids.ts # UID 直播状态查询
│   │   ├── constant.ts         # Bilibili API 常量
│   │   └── sign/               # Bilibili 签名算法
│   ├── douyin/               # 抖音 API
│   │   ├── api.ts              # 抖音用户信息获取
│   │   ├── userprofile.ts      # 用户资料获取
│   │   ├── defaultConfig.ts    # 默认配置
│   │   └── sign/               # 抖音签名算法
│   └── telegram/             # Telegram Bot API
│       └── bot.ts              # TelegramBot 类封装
├── storage/                # 存储抽象层
│   ├── KVStore.ts            # KV 封装，支持前缀隔离
│   ├── D1DB.ts               # D1 数据库操作封装
│   ├── DY.ts                 # 抖音数据模型
│   └── init.sql              # 数据库表结构定义
├── constants/              # 常量定义
│   └── KVstoreKey.ts         # KV 键名常量
└── templates/              # HTML 模板
    ├── api-test.html         # API 测试页面
    └── welcome.html          # 欢迎页面
```

### 存储架构

#### KV 命名空间

使用单一 KV 命名空间（绑定名：`live_notify_tgbot`），通过前缀隔离不同平台的数据：

| 键格式 | 说明 |
|---------|------|
| `BL_uid_roomid` | Bilibili 主播监控列表 `[{uid, roomid, name}]` |
| `BL_last_status` | Bilibili 缓存状态 `[{uid, roomid, name, live_status, title, attention, guardNum}]` |
| `DY_userlist` | 抖音用户 sec_uid 列表 |
| `DY_last_info_status` | 抖音用户上次直播状态映射 `{sec_uid: live_status}` |

> KV 写入策略：仅在 `live_status`、`attention`、`title`、`guardNum` 发生变化时写入，直播期间实时观看人数变化不触发 KV 写入。

#### D1 数据库

绑定名：`live_notify`。表结构定义在 `src/storage/init.sql`。

**BLUsers 表** - Bilibili 直播记录（直播期间每分钟写入）
```sql
CREATE TABLE IF NOT EXISTS BLUsers (
    ind INTEGER PRIMARY KEY AUTOINCREMENT,
    record_time INTEGER,
    name TEXT,
    uid INTEGER,
    room_id INTEGER,
    live_status INTEGER,
    title TEXT,
    live_time INTEGER,
    attention INTEGER,
    onlineNum INTEGER,
    audience_rank TEXT,
    guardNum INTEGER,
    guardDetail TEXT,
    tags TEXT,
    parent_area_id INTEGER,
    parent_area_name TEXT,
    area_id INTEGER,
    area_name TEXT
);
```

**DYUsers 表** - 抖音用户记录（状态变化时写入）
```sql
CREATE TABLE IF NOT EXISTS DYUsers (
    ind INTEGER PRIMARY KEY AUTOINCREMENT,
    record_time INTEGER NOT NULL,
    sec_uid TEXT NOT NULL,
    nickname TEXT NOT NULL,
    live_status INTEGER NOT NULL,
    follower_count INTEGER,
    max_follower_count INTEGER,
    total_favorited INTEGER,
    ip_location TEXT,
    signature TEXT
);
```

### 直播状态值

| 状态值 | 含义 |
|---------|------|
| 0 | 已下播 |
| 1 | 正在直播 |
| 2 | 轮播中 |

## HTTP 路由

使用 [Hono](https://hono.dev/) 框架进行路由管理。

| 路由 | 方法 | 说明 |
|-------|------|------|
| `/` `/index.html` `/api-test` `/api-test.html` | GET | API 测试页面 |
| `/tgbot` | GET | Webhook 状态信息页（显示 `getWebhookInfo`） |
| `/tgbot/init` | GET | 初始化 Telegram Webhook 和机器人命令列表 |
| `/tgbot/uninit` | GET | 删除 Webhook（用于重置） |
| `/tgbot/webhook` | POST | Telegram Webhook 处理器（接收消息更新） |

## Telegram 命令

| 命令 | 用法 | 说明 |
|-------|------|------|
| `/start` | `/start` | 检查机器人连通性 |
| `/help` | `/help` | 显示可用命令列表 |
| `/bladd` | `/bladd <uid>[,<uid>,...]` | 添加 Bilibili 主播 |
| `/blrm` | `/blrm <uid>[,<uid>,...]` | 移除 Bilibili 主播 |
| `/blls` | `/blls` | 列出 Bilibili 主播 |
| `/adddy` | `/adddy <sec_uid>` | 添加抖音用户 |
| `/rmdy` | `/rmdy <sec_uid>` | 移除抖音用户 |
| `/lsdy` | `/lsdy` | 列出抖音用户 |
| `/lsall` | `/lsall` | 列出所有平台的监控用户 |

## 配置

### wrangler.jsonc 配置

```jsonc
{
  "name": "live-notify-tgbot-cf",
  "kv_namespaces": [
    {
      "binding": "live_notify_tgbot",
      "id": "your-kv-namespace-id"
    }
  ],
  "d1_databases": [
    {
      "binding": "live_notify",
      "database_name": "live_notify",
      "database_id": "your-d1-database-id"
    }
  ],
  "triggers": {
    "crons": ["*/1 * * * *"]
  }
}
```

### 环境变量

| 变量名 | 说明 | 类型 |
|---------|------|------|
| `BOT_TOKEN` | Telegram 机器人 token | Secret |
| `CHAT_ID` | 推送消息的目标群组/聊天 ID | Secret |
| `DY_COOKIE1` | 抖音 API 认证 Cookie | Secret |
| `USER_AGENT` | 抖音 API 请求 User-Agent | 环境变量（已在 wrangler.jsonc 中设置默认值） |

## 部署

### 前置准备

1. 注册 Cloudflare 账号

2. 克隆代码并安装依赖（需要nodejs环境，至少18+，建议24+，本项目用的是24）

```bash
npm install
```

3. 登录 Cloudflare

```bash
npx wrangler login
```

4. 创建 KV 命名空间和 D1 数据库。

这里都用 live_notify 作为命名空间和数据库名，实际上可以自定义。但如果使用自定义的名称，需要同步修改 `wrangler.jsonc` 中的 `kv_namespaces` 和 `d1_databases` 配置，填入你的KV和d1的相关信息。代码里也需要有对应的修改。尤其是`src/storage/`下的文件。

```bash
# 创建 KV
npx wrangler kv namespace create live_notify_tgbot
# 创建 D1
npx wrangler d1 create live_notify
```

你也可以使用 dashboard 来创建 KV 和 D1 数据库。然后手动把id填入`wrangler.jsonc`中的`kv_namespaces`和`d1_databases`配置里。注意，KV和D1的id需要和`wrangler.jsonc`中的配置一致。

5. 创建 Telegram Bot，获取bot token；获取要发送推送信息的 Chat ID。

向 @BotFather 发送 `/newbot` 命令，按照提示创建 bot，获取 token。Chat ID 是指 bot 要向哪个聊天发送信息，可以是个人聊天、群聊或频道，具体获取方式请自行搜索。

6. 初始化 D1 数据库表结构

```bash
npx wrangler d1 execute live_notify --file=src/storage/init.sql --remote
```

7. 生成类型定义（可选）

```bash
npx wrangler types
```

### 部署到生产环境

```bash
npm run deploy
```

### 添加环境变量

```bash
npx wrangler secret put BOT_TOKEN
npx wrangler secret put CHAT_ID
npx wrangler secret put DY_COOKIE1
npx wrangler secret put BL_COOKIE1
```

通常，出于安全性考虑，不建议将 cookie 和 bot_token 等敏感信息直接以明文形式放在环境变量中。本地开发时，可以使用 `.env` 文件来管理这些敏感信息。部署到 CF 后，**你也可以通过 Dashboard 复制粘贴 `.env` 文件里的内容来快速添加环境变量。**

### 部署后初始化

部署完成后，访问以下 URL 初始化 Webhook 和命令列表：

```
https://your-worker-url/tgbot/init
```

向机器人发送 `/start` 确认连通性。

### 注意事项

- 项目名称（wrangler.jsonc 中的 `name`）**不要使用下划线**，否则会影响 SSL 证书的生成，导致 Telegram Webhook 无法通过 HTTPS 访问。建议使用连字符（`-`）。
- 如果遇到 Webhook SSL 错误，尝试先访问 `/tgbot/uninit` 删除 Webhook，再访问 `/tgbot/init` 重新设置。

## 本地开发

### 启动开发服务器

```bash
npm run dev
# 或
npm start
```

这将启动本地开发服务器，支持定时任务模拟（`--test-scheduled`）。

### 测试定时任务

在本地开发环境中，可以使用以下命令模拟定时触发：

```bash
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```

### 重新生成类型定义

修改 `wrangler.jsonc` 中的绑定后，运行：

```bash
npx wrangler types
```
或
```bash
npm run cf-typegen
```

## 开发注意事项

- 抖音 API 需要签名，签名算法在 `src/platforms/douyin/sign/` 中实现
- `KVStore` 类提供类型安全的 KV 访问，建议始终使用此封装而非直接访问 KV
- 任何 cookie 都有可能过期，需要定期更新
- Bilibili 直播期间每分钟写入 D1 记录；抖音仅在状态变化时写入

## 许可证

MIT
