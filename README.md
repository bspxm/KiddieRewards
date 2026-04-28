<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# KiddieRewards — 圆滚滚银行

一个家庭行为奖励追踪应用。家长自定义任务和奖励规则，孩子通过完成任务赚取积分，再用积分兑换心仪的奖励。支持多家庭共享部署、管理员工具和完整操作日志。

## 功能特性

- **家庭隔离** — 多家庭共享同一实例，数据按家庭独立管理
- **任务积分系统** — 家长创建每日/一次性任务规则，孩子提交完成，家长审核通过即获得积分
- **奖励兑换** — 孩子用积分兑换奖励，家长审批，系统自动扣减积分
- **成长追踪** — 30天积分趋势图表、任务与兑换历史时间线
- **通知系统** — 任务审核、奖励兑换等事件实时通知
- **多主题支持** — 多种视觉主题，支持暗色模式
- **管理后台** — 超级管理员可查看所有家庭、操作日志，管理家庭数据
- **安全机制** — JWT 会话认证、CSRF 防护、暴力破解保护、bcrypt 密码加密、HTTP 安全头

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19, Vite 6, Tailwind CSS 4, TypeScript |
| 后端 | Express.js, TypeScript (tsx 运行时) |
| 数据库 | SQLite (better-sqlite3) |
| 认证 | JWT (jsonwebtoken), bcrypt |
| UI 组件 | framer-motion, lucide-react, recharts |
| AI | Google Gemini (`@google/genai`) |

## 快速开始

### 本地开发

**前置要求**: Node.js 18+

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（可选）
cp .env.example .env
# 编辑 .env 设置 GEMINI_API_KEY 等

# 3. 启动开发服务器
npm run dev
```

应用将在 `http://localhost:3000` 启动。首次启动会自动创建数据库并初始化示例家庭「乐家」。

### 示例账户

| 角色 | 用户名 | 密码 |
|---|---|---|
| 家长 | 乐爸@乐家 / 乐妈@乐家 | `Kiddie@2026!` |
| 孩子 | 小乐@乐家 | `Kiddie@2026!` |
| 管理员 | admin | `Admin@Kiddie2026!` |

### 构建与部署

```bash
# 构建前端静态资源
npm run build

# 预览生产构建
npm run preview

# 类型检查
npm run lint

# Docker 构建与导出
./build-docker.sh [version]
# 默认版本为 latest，可指定如 v1.0.0

# 恢复 Docker 镜像
gunzip -c kiddierewards-latest.tar.gz | docker load
docker run -d -p 3000:3000 -v /path/to/data:/app/data kiddierewards:latest
```

Docker 镜像使用华为云镜像源构建，适合中国大陆网络环境。

## 项目结构

```
├── server.ts              # 服务器入口 (Express + Vite + SQLite)
├── server/
│   ├── auth.ts            # JWT 认证 & 密码加密
│   └── logger.ts          # 结构化操作日志 (JSONL)
├── src/
│   ├── App.tsx            # 根组件 (认证状态、主题、角色渲染)
│   ├── main.tsx           # Vite 入口
│   ├── types.ts           # TypeScript 类型定义
│   ├── index.css          # Tailwind + 主题样式
│   ├── components/
│   │   ├── Admin/         # 管理员后台
│   │   ├── Auth/          # 登录界面
│   │   ├── Parent/        # 家长管理面板
│   │   ├── Child/         # 孩子操作界面
│   │   ├── Layout/        # 共享导航栏
│   │   └── ui/            # 通用 UI 组件
│   ├── hooks/             # 自定义 Hooks
│   └── lib/               # API 客户端 & 工具函数
├── data/                  # SQLite 数据库 (自动创建)
├── logs/                  # 操作日志 (按年月归档)
└── dist/                  # 生产构建输出
```

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `JWT_SECRET` | 否 | 自动生成并持久化至 `data/.jwt_secret` | JWT 签名密钥 |
| `GEMINI_API_KEY` | 否 | — | Gemini AI API 密钥（构建时注入） |
| `SOCKET_ORIGINS` | 否 | — | CSRF 验证允许的源列表（逗号分隔） |
| `NODE_ENV` | 否 | — | 设为 `production` 启用静态文件服务 |
| `DEFAULT_PARENT_PASSWORD` | 否 | `Kiddie@2026!` | 示例家长密码 |
| `DEFAULT_ADMIN_PASSWORD` | 否 | `Admin@Kiddie2026!` | 示例管理员密码 |

## 数据模型

应用使用 SQLite 数据库，主要数据表：

- **families** — 家庭组
- **users** — 用户（家长/孩子/管理员）
- **reward_rules** — 任务规则（每日重复或一次性）
- **rewards** — 可兑换奖励目录
- **task_submissions** — 孩子任务提交记录
- **redemption_records** — 奖励兑换申请
- **point_history** — 积分收支流水
- **notifications** — 站内通知
- **server_meta** — 服务器元数据

## API 端点

所有 API 路径以 `/api` 开头。除登录和注册外，其余端点均需 `Bearer <token>` 认证。

### 认证
- `POST /api/login` — 登录（支持 `用户名@家庭名` 格式或 `admin`）
- `POST /api/logout` — 登出（加入令牌黑名单）
- `POST /api/register/family` — 注册新家庭

### 用户管理
- `GET /api/users` — 获取家庭成员列表
- `POST /api/users/add-member` — 添加家庭成员
- `POST /api/users/update-profile` — 更新个人信息
- `DELETE /api/users/:id` — 删除用户

### 任务与积分
- `GET /api/rules/:uid` — 获取任务规则
- `POST /api/rules` — 创建任务规则
- `POST /api/tasks/submit` — 孩子提交任务
- `POST /api/tasks/approve` — 家长审批任务
- `POST /api/points/add` — 手动添加积分

### 奖励兑换
- `GET /api/rewards/:uid` — 获取奖励目录
- `POST /api/redemptions` — 申请兑换奖励
- `POST /api/redemptions/approve` — 审批兑换申请

### 统计与通知
- `GET /api/stats/:childId` — 30天积分趋势
- `GET /api/history/:childId` — 积分历史
- `GET /api/notifications/:userId` — 获取通知

### 管理员
- `GET /api/admin/families` — 查看所有家庭
- `GET /api/admin/logs` — 查看操作日志
- `DELETE /api/admin/families/:id` — 删除家庭（级联）

## 安全特性

- **HTTP 安全头** — 每个响应附加 X-Content-Type-Options, X-Frame-Options, CSP 等
- **CSRF 防护** — 校验 Origin/Referer，同源请求自动放行（支持反向代理/Cloudflare）
- **暴力破解保护** — 同一 IP+用户名 5 次失败后冷却 10 分钟
- **令牌黑名单** — 登出后令牌立即失效
- **注册频率限制** — 每 IP 每分钟最多 5 次家庭注册
- **代理支持** — 启用 trust proxy，支持 Cloudflare 真实 IP 检测

## 注意事项

- 数据库迁移通过 `server.ts` 启动时的 try/catch `ALTER TABLE` 实现，无独立迁移框架
- better-sqlite3 为同步操作，所有数据库调用会阻塞事件循环
- JWT 会话存储于内存，服务器重启后会话丢失（令牌 24 小时过期）
- 无单元测试和集成测试
- `react-router-dom` 仅用于 `<BrowserRouter>` 包裹，实际导航通过条件渲染实现

## 许可

Apache-2.0
