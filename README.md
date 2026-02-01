# tgbot-pusher2

基于 Cloudflare Worker 的 Telegram 机器人，用于监控 Bilibili 和抖音（Douyin）主播的直播状态，当检测到状态变化时推送通知到指定 Telegram 群组。

## 功能概述

- **直播状态监控**：定时（默认每分钟）检查 Bilibili 和抖音主播的直播状态
- **状态变化通知**：当主播的直播状态发生变化（开播、下播、轮播）时，自动发送 Telegram 消息通知
- **数据持久化**：将状态变化记录到 Cloudflare D1 数据库
- **用户管理**：通过 Telegram 命令添加/删除/查看被监控的主播列表
- **API 测试页面**：提供 Web 界面进行 API 测试

## 项目架构

### 目录结构

```
src/
├── handlers/       # HTTP 路由处理器
│   ├── tgbot.ts      # /tgbot 欢迎页面
│   ├── tgbotFunc.ts  # Telegram Webhook 处理，命令解析
│   └── tgbotInit.ts  # /tgbot/init 初始化 Webhook 和命令
├── utils/          # 第三方 API 封装
│   ├── bilibili.ts    # Bilibili 直播信息获取
│   ├── douyin.ts     # 抖音用户信息和直播状态获取
│   └── telegram.ts   # Telegram API 调用
├── storage/        # 存储抽象层
│   ├── KVStore.ts     # KV 封装，支持前缀隔离
│   ├── D1DB.ts        # D1 数据库操作封装
│   └── init.sql       # 数据库表结构定义
├── pusher/         # 定时任务逻辑
│   └── scheduledPush.ts  # 直播状态检查和推送逻辑
├── platforms/      # 平台相关实现
│   └── douyin/
│       ├── userprofile.ts  # 抖音用户资料获取
│       └── sign.ts        # 抖音签名算法
├── constants/      # 常量定义
│   └── commands.ts   # Telegram 命令列表
├── datamodel/      # 数据模型
│   ├── USER_BL.ts    # Bilibili 用户数据模型
│   └── DY.ts         # 抖音用户数据模型
└── templates/      # HTML 模板
    ├── api-test.html   # API 测试页面
    └── welcome.html    # 欢迎页面
```

### 存储架构

#### KV 命名空间 (`liveinfo`)

使用单一 KV 命名空间，通过前缀隔离不同平台的数据：

| 键格式 | 说明 |
|---------|------|
| `BL_userlist` | Bilibili 用户 UID 列表 |
| `BL_last_info_status` | Bilibili 用户上次直播状态映射 `{uid: live_status}` |
| `DY_userlist` | 抖音用户 sec_uid 列表 |
| `DY_last_info_status` | 抖音用户上次直播状态映射 `{sec_uid: live_status}` |

#### D1 数据库 (`streamers`)

**BLUsers 表** - Bilibili 用户记录
```sql
CREATE TABLE IF NOT EXISTS BLUsers (
    ind INTEGER PRIMARY KEY AUTOINCREMENT,
    record_time INTEGER NOT NULL,
    uid INTEGER NOT NULL,
    name TEXT,
    attention INTEGER,
    roomid INTEGER,
    live_title TEXT,
    live_status INTEGER,
    live_start_time INTEGER,
    live_watchers INTEGER,
    guard_num INTEGER,
    guard_details TEXT
);
```

**DYUsers 表** - 抖音用户记录
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

| 路由 | 方法 | 说明 |
|-------|------|------|
| `/` 或 `/api-test` | GET | API 测试页面 |
| `/tgbot` | GET | 欢迎页面，显示 Webhook 信息 |
| `/tgbot/init` | GET | 初始化 Telegram Webhook 和机器人命令 |
| `/tgbot/func` | POST | Telegram Webhook 处理器，接收更新和命令 |

## Telegram 命令

| 命令 | 用法 | 说明 |
|-------|------|------|
| `/add_bluser` | `/add_bluser <uid>` | 添加 Bilibili 用户 |
| `/rm_bluser` | `/rm_bluser <uid>` | 移除 Bilibili 用户 |
| `/ls_bluser` | `/ls_bluser` | 列出 Bilibili 用户 |
| `/add_dyuser` | `/add_dyuser <sec_user_id>` | 添加抖音用户 |
| `/rm_dyuser` | `/rm_dyuser <sec_user_id>` | 移除抖音用户 |
| `/ls_dyuser` | `/ls_dyuser` | 列出抖音用户 |
| `/ls_alluser` | `/ls_alluser` | 列出所有平台的监控用户 |

## 配置

### wrangler.jsonc 配置

在 `wrangler.jsonc` 中配置以下内容：

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "liveinfo",
      "id": "your-kv-namespace-id",
      "preview_id": "your-preview-kv-id"
    }
  ],
  "d1_databases": [
    {
      "binding": "streamers",
      "database_name": "streamers",
      "database_id": "your-d1-database-id"
    }
  ],
  "triggers": {
    "crons": [
      "*/1 * * * *"  // 每分钟执行一次
    ]
  }
}
```

### 环境变量

| 变量名 | 说明 | 类型 |
|---------|------|------|
| `BOT_TOKEN` | Telegram 机器人 token | Secret |
| `CHAT_ID` | 推送消息的目标群组/聊天 ID | string |
| `DY_COOKIE1` | 抖音 API 认证 Cookie | Secret |
| `USER_AGENT` | 抖音 API 请求 User-Agent | string |

### 设置环境变量

```bash
# 方式一：使用 wrangler secrets（推荐用于敏感信息）
npx wrangler secret put BOT_TOKEN
npx wrangler secret put CHAT_ID
npx wrangler secret put DY_COOKIE1

# 方式二：使用本地 .env 文件（仅开发环境）
# 在项目根目录创建 .env 文件：
BOT_TOKEN=your_bot_token
CHAT_ID=your_chat_id
DY_COOKIE1=your_cookie
```

## 部署

### 前置准备

1. 安装 Node.js 依赖
```bash
npm install
```

2. 登录 Cloudflare
```bash
npx wrangler login
```

3. 创建 KV 命名空间和 D1 数据库（在 Cloudflare 控制台操作）

4. 更新 `wrangler.jsonc` 中的 `kv_namespaces` 和 `d1_databases` 配置

5. 初始化 D1 数据库表结构
```bash
npx wrangler d1 execute streamers --file=src/storage/init.sql
```

6. 设置环境变量（见上文配置）

### 部署到生产环境

```bash
npm run deploy
```

### 部署后初始化

部署完成后，访问以下 URL 初始化 Webhook：
```
https://your-worker-url.tgbot/init
```

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

- 抖音 API 需要签名，签名算法在 `src/platforms/douyin/sign.ts` 中实现
- `KVStore` 类提供类型安全的 KV 访问，建议始终使用此封装而非直接访问 KV
- 状态变化时才会写入数据库，避免冗余记录
- `DY_COOKIE` 可能会过期，需要定期更新

## 相关文件说明

| 文件 | 说明 |
|-------|------|
| `src/handlers/tgbotFunc.ts` | 命令解析和 KV 列表管理 |
| `src/pusher/scheduledPush.ts` | 定时任务执行器，包含 `getBLInfos` 和 `getDYInfos` |
| `src/utils/bilibili.ts` | Bilibili 直播信息 API 封装 |
| `src/utils/douyin.ts` | 抖音用户信息和直播状态 API 封装 |
| `src/storage/D1DB.ts` | D1 数据库操作封装（`insertUserBL`, `insertUserDY`） |
| `src/storage/KVStore.ts` | KV 存储封装，支持平台前缀隔离 |

## 许可证

MIT
