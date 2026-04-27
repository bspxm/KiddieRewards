# KiddieRewards 安全审计报告

> **审计日期**: 2026-04-27
> **审计范围**: 全项目代码（后端 server.ts + server/auth.ts + server/logger.ts，前端 React 组件，package.json）
> **审计方式**: 静态代码审查，逐行分析所有 API 端点的认证/授权逻辑、输入验证、数据流

---

## 一、执行摘要

本项目存在 **30 个安全漏洞**，按严重等级分布：

| 等级 | 数量 | 说明 |
|------|------|------|
| 🔴 严重 (CRITICAL) | 10 | 可导致积分篡改、跨家庭数据泄露、密码哈希窃取 |
| 🟠 高危 (HIGH) | 8 | 权限绕过、越权操作、硬编码凭据 |
| 🟡 中危 (MEDIUM) | 7 | 缺失安全头、无 CSRF、无 Token 注销 |
| 🟢 低危 (LOW) | 5 | 信息泄露、弱密码策略、敏感信息日志 |

**核心风险模式**: 大量 API 端点仅检查"已登录"，但不校验请求者是否有权操作目标资源。攻击者可以利用任意已登录用户的 JWT，跨越家庭边界读写数据、篡改积分体系。

---

## 二、严重漏洞 (CRITICAL)

### CRIT-01: 任务审批积分篡改 — 可任意增发积分

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:926-984` |
| **端点** | `POST /api/tasks/approve` |
| **CVSS 估算** | 9.1 |

**问题描述**: 审批任务时，`points` 值直接取自请求体（第 927 行），服务端没有将其与规则的原始积分值进行校验。第 952 行直接将客户端传入的 `points` 累加到孩子账户。

```typescript
// server.ts:927 — points 来自客户端
const { id, childId, points, title } = req.body;
// server.ts:952 — 直接使用客户端传入的 points
db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(points, childId);
```

**攻击场景**: 家长登录后，发送 `POST /api/tasks/approve`，将 `points` 设置为 `99999`，即可为该孩子账户注入任意积分。

**PoC**:
```bash
curl -X POST http://localhost:3000/api/tasks/approve \
  -H "Authorization: Bearer <家长token>" \
  -H "Content-Type: application/json" \
  -d '{"id":"任意任务ID","childId":"目标孩子ID","points":99999,"title":"刷分"}'
```

---

### CRIT-02: 兑换审批积分扣费可控 — 可零成本兑换

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:1050-1096` |
| **端点** | `POST /api/redemptions/approve` |
| **CVSS 估算** | 8.6 |

**问题描述**: `pointsCost` 取自请求体（第 1051 行），第 1066 行直接扣除该金额。攻击者可设置 `pointsCost: 0`，在不扣除任何积分的情况下批准兑换。

```typescript
// server.ts:1051
const { id, childId, rewardId, pointsCost, rewardTitle } = req.body;
// server.ts:1066
db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(pointsCost, childId);
```

**修复建议**: 服务端应从 `rewards` 表查询该 `rewardId` 对应的 `pointsRequired` 作为扣费依据，而非信任客户端。

---

### CRIT-03: 用户信息 IDOR — 密码哈希泄露

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:745-748` |
| **端点** | `GET /api/users/:id` |
| **CVSS 估算** | 9.1 |

**问题描述**: 该端点返回 `SELECT * FROM users`，包含 `password` 字段（bcrypt 哈希）。**无任何家庭校验或权限校验**——任何已登录用户可查询任意用户的完整信息。

```typescript
// server.ts:745-748
app.get('/api/users/:id', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.json(user); // ← 包含 password 哈希！且无 family 校验
});
```

**攻击场景**:
1. 孩子账号登录后，枚举其他家庭用户 ID，获取密码哈希
2. 离线暴力破解 bcrypt 哈希
3. 获取其他家庭成员的凭据

---

### CRIT-04: 任务删除无授权校验

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:1183-1190` |
| **端点** | `DELETE /api/tasks/:id` |
| **CVSS 估算** | 7.5 |

**问题描述**: 仅需认证，任何已登录用户可删除任意家庭的任何任务提交记录。

```typescript
app.delete('/api/tasks/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM task_submissions WHERE id = ?').run(req.params.id);
  // ← 无 family 校验，无角色校验
});
```

---

### CRIT-05: 兑换记录删除无授权校验

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:1192-1199` |
| **端点** | `DELETE /api/redemptions/:id` |
| **CVSS 估算** | 7.5 |

与 CRIT-04 相同的模式——任何已登录用户可删除任意兑换记录。

---

### CRIT-06: 兑换申请创建无认证用户校验

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:1022-1036` |
| **端点** | `POST /api/redemptions` |
| **CVSS 估算** | 7.5 |

**问题描述**: `childId`、`parentId`、`rewardId` 全部来自请求体，服务端仅用 `parentId` 查找 familyId，**不校验 `childId` 是否属于该家庭、不校验认证用户与 `childId` 的关系**。

```typescript
app.post('/api/redemptions', authMiddleware, (req, res) => {
  const { id, childId, parentId, rewardId, rewardTitle } = req.body;
  // ← 未校验 authUser.id 是否等于 childId（冒充他人申请兑换）
  // ← 未校验 childId 是否属于 parentId 的家庭
});
```

---

### CRIT-07: 兑换记录跨家庭查询 — 无授权校验

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:1045-1048` |
| **端点** | `GET /api/redemptions/child/:childId` |
| **CVSS 估算** | 7.5 |

```typescript
app.get('/api/redemptions/child/:childId', authMiddleware, (req, res) => {
  const records = db.prepare('SELECT * FROM redemption_records WHERE childId = ? ORDER BY timestamp DESC').all(req.params.childId);
  // ← 无 family 校验——任意用户可查询任意孩子的兑换记录
});
```

---

### CRIT-08: 成长历史跨家庭访问

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:1146-1181` |
| **端点** | `GET /api/growth-history/:parentId` |
| **CVSS 估算** | 7.5 |

**问题描述**: 服务端通过 `parentId` 查找 `familyId`，但**不校验认证用户是否属于该 family**。任何用户传入其他家庭的 `parentId` 即可查询该家庭的完整成长历史。

```typescript
app.get('/api/growth-history/:parentId', authMiddleware, (req, res) => {
  const parentId = req.params.parentId;
  const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(parentId) as any;
  // ← 未校验 authUser.familyId === user.familyId
});
```

---

### CRIT-09: 通知跨用户操作

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:586-590` |
| **端点** | `POST /api/notifications/read` |
| **CVSS 估算** | 6.5 |

**问题描述**: `userId` 来自请求体，任意用户可将其他用户的标记为已读，造成骚扰/信息清除。

```typescript
app.post('/api/notifications/read', authMiddleware, (req, res) => {
  const { userId } = req.body;
  db.prepare('UPDATE notifications SET isRead = 1 WHERE userId = ?').run(userId);
  // ← 未校验 authUser.id === userId
});
```

同样，`GET /api/notifications/:userId`（server.ts:580-584）也缺失此校验。

---

### CRIT-10: 个人资料更新可修改他人密码

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:679-700` |
| **端点** | `POST /api/users/update-profile` |
| **CVSS 估算** | 7.5 |

**问题描述**: 授权逻辑仅检查 `authUser.id !== userId && authUser.role !== 'admin'`。同一家庭内的其他 parent 可以修改任意家庭成员的密码。

```typescript
app.post('/api/users/update-profile', authMiddleware, async (req, res) => {
  const { userId, name, password } = req.body;
  // server.ts:683
  if (authUser.id !== userId && authUser.role !== 'admin') {
    return res.status(403).json(...);
  }
  // ← 同一家庭的 parent 可以修改其他用户的密码
  // ← 无原密码验证
});
```

---

## 三、高危漏洞 (HIGH)

### HIGH-01: 规则创建/修改/删除无所有权校验

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:760-797` |
| **端点** | `POST /api/rules`, `PUT /api/rules/:id`, `DELETE /api/rules/:id` |

```typescript
// POST — server.ts:761
const { id, parentId, title, points, ... } = req.body;
// ← 不校验 authUser 是否就是该 parentId 对应的用户

// PUT/DELETE — server.ts:787-797
// ← 不校验规则是否属于认证用户的家庭
```

**攻击场景**: A 家庭的 child 可为 B 家庭的 parent 创建规则、修改积分值、删除规则。

---

### HIGH-02: 奖励创建/修改/删除无所有权校验

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:820-838` |
| **端点** | `POST /api/rewards`, `PUT /api/rewards/:id`, `DELETE /api/rewards/:id` |

与 HIGH-01 相同的模式。

---

### HIGH-03: 任务提交可冒充其他孩子

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:885-924` |
| **端点** | `POST /api/tasks/submit` |

**问题描述**: 虽然校验了 `childId` 和认证用户在同一家庭，但**不校验 `authUser.id === childId`**。同一家庭内的一个孩子可以冒充另一个孩子提交任务。

```typescript
// server.ts:888-889
const child = db.prepare('SELECT familyId FROM users WHERE id = ?').get(childId) as any;
if (!child || child.familyId !== authUser.familyId) {
  // ← 只校验同家庭，不校验就是本人
}
```

---

### HIGH-04: 硬编码默认密码

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:193-194`, `server.ts:220-238` |
| **位置** | 种子数据初始化 |

```typescript
const defaultPwdHash = await hashPassword('123456');
const adminPwdHash = await hashPassword('admin123');
```

示例家庭 "乐家" 的 parent 密码为 `123456`，admin 密码为 `admin123`。如果部署到生产环境未修改，攻击者可暴力猜测。

---

### HIGH-05: JWT_SECRET 自动生成导致会话不稳定

| 项目 | 内容 |
|------|------|
| **文件** | `server/auth.ts:5-8` |

```typescript
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
```

未设置 `JWT_SECRET` 时，每次重启生成新密钥，所有已登录用户的 token 失效。虽然这不是直接的安全漏洞，但会导致用户频繁被踢出，降低安全性（用户可能选择记住密码来应对）。

---

### HIGH-06: 积分手动添加无规则关联

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:840-860` |
| **端点** | `POST /api/points/add` |

**问题描述**: 家长可以为孩子添加任意数量的积分，无需关联任何规则或任务。虽然校验了同家庭和 parent 角色，但缺乏审计追踪。

---

### HIGH-07: 明文密码兼容回退

| 项目 | 内容 |
|------|------|
| **文件** | `server/auth.ts:24-30` |

```typescript
if (!hash.startsWith('$2')) {
  return password === hash; // ← 支持明文密码登录
}
```

虽然 `initDefaults()` 尝试迁移明文密码，但如果迁移失败或被绕过，旧数据仍可用明文密码登录。

---

### HIGH-08: 用户查询/历史/统计接口无家庭边界校验

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:862-876` |
| **端点** | `GET /api/tasks/rejected/:childId`, `GET /api/tasks/all/:childId`, `GET /api/history/:childId`, `GET /api/stats/:childId` |

```typescript
app.get('/api/history/:childId', authMiddleware, (req, res) => {
  const history = db.prepare('SELECT * FROM point_history WHERE childId = ? ORDER BY timestamp DESC').all(req.params.childId);
  // ← 无 family 校验
});
```

任意用户可查询任意孩子的积分历史和任务记录。

---

## 四、中危漏洞 (MEDIUM)

### MED-01: 缺失 HTTP 安全头

| 项目 | 内容 |
|------|------|
| **文件** | `server.ts:274-300` |

未使用 `helmet` 或手动设置安全头。缺失：
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-XSS-Protection`

### MED-02: 无 CSRF 保护

JWT 通过 Bearer token 传递（在 Authorization header 中），当前架构下 CSRF 风险较低。但如果将来改为 cookie 存储 token，将立即暴露 CSRF 风险。

### MED-03: 家庭注册无频率限制

| 文件 | `server.ts:602-637` |

`POST /api/register/family` 无速率限制，可被滥用进行账户洪水攻击。

### MED-04: 无 Token 黑名单/注销机制

退出登录仅删除 localStorage 中的 token。服务端无法使 token 失效——在 24 小时过期前，被盗的 token 仍可被使用。

### MED-05: JWT 载荷信息暴露

| 文件 | `server/auth.ts:12-14` |

JWT payload 包含 `familyId`、`parentId`、`role` 等敏感信息。JWT 仅签名不加密，攻击者可解码获取家庭结构信息。

### MED-06: 任务重新激活无授权校验

| 文件 | `server.ts:799-808` |
| 端点 | `POST /api/rules/reactivate` |

可归档任意孩子-规则组合的已批准提交，无家庭校验。

### MED-07: 依赖包安全

`package.json` 未锁定精确版本（使用 `^`），可能存在已知 CVE 的传递依赖。建议运行 `npm audit`。

---

## 五、低危漏洞 (LOW)

### LOW-01: 详细的错误信息泄露

服务端返回具体错误信息（"Family not found"、"User not found in family"、"孩子星币余额不足"），攻击者可利用这些信息进行用户枚举和家庭枚举。

### LOW-02: 控制台日志泄露敏感信息

| 文件 | `server.ts:332` |

```typescript
console.log(`[AUTH DEBUG] Login attempt: [${name}]`);
```

登录尝试的用户名被记录到控制台。

### LOW-03: localStorage 存储 Token

| 文件 | `src/lib/api.ts:2` |

JWT 存储在 localStorage，可被 XSS 攻击读取。建议改用 `httpOnly` cookie。

### LOW-04: 密码策略薄弱

最小密码长度仅 6 位，无复杂度要求。

### LOW-05: 日志中存储未转义的用户输入

| 文件 | `server/logger.ts:36` |

用户输入（如任务标题、拒绝原因）直接写入 JSON 日志，包含换行符或引号时可破坏日志格式。

---

## 六、漏洞汇总矩阵

| 编号 | 等级 | 端点 | 文件 | 核心问题 |
|------|------|------|------|----------|
| CRIT-01 | 🔴 | `POST /api/tasks/approve` | server.ts:926 | 积分值来自客户端，可篡改 |
| CRIT-02 | 🔴 | `POST /api/redemptions/approve` | server.ts:1050 | pointsCost 来自客户端，可设 0 |
| CRIT-03 | 🔴 | `GET /api/users/:id` | server.ts:745 | 泄露密码哈希 + 无家庭校验 |
| CRIT-04 | 🔴 | `DELETE /api/tasks/:id` | server.ts:1183 | 无授权校验 |
| CRIT-05 | 🔴 | `DELETE /api/redemptions/:id` | server.ts:1192 | 无授权校验 |
| CRIT-06 | 🔴 | `POST /api/redemptions` | server.ts:1022 | 可冒充他人创建兑换 |
| CRIT-07 | 🔴 | `GET /api/redemptions/child/:id` | server.ts:1045 | 跨家庭查询 |
| CRIT-08 | 🔴 | `GET /api/growth-history/:id` | server.ts:1146 | 跨家庭查询 |
| CRIT-09 | 🔴 | `POST /api/notifications/read` | server.ts:586 | 可操作他人通知 |
| CRIT-10 | 🔴 | `POST /api/users/update-profile` | server.ts:679 | 可修改他人密码 |
| HIGH-01 | 🟠 | Rules CRUD | server.ts:760-797 | 规则无所有权校验 |
| HIGH-02 | 🟠 | Rewards CRUD | server.ts:820-838 | 奖励无所有权校验 |
| HIGH-03 | 🟠 | `POST /api/tasks/submit` | server.ts:885 | 可冒充同家庭其他孩子 |
| HIGH-04 | 🟠 | 种子数据 | server.ts:193 | 硬编码默认密码 |
| HIGH-05 | 🟠 | JWT | server/auth.ts:5 | 密钥自动生成 |
| HIGH-06 | 🟠 | `POST /api/points/add` | server.ts:840 | 无规则关联 |
| HIGH-07 | 🟠 | 密码验证 | server/auth.ts:26 | 明文密码回退 |
| HIGH-08 | 🟠 | 多个查询接口 | server.ts:862-876 | 无家庭边界 |
| MED-01 | 🟡 | 全局 | server.ts | 无 HTTP 安全头 |
| MED-02 | 🟡 | 全局 | — | 无 CSRF |
| MED-03 | 🟡 | `POST /api/register/family` | server.ts:602 | 无频率限制 |
| MED-04 | 🟡 | 全局 | — | 无 Token 黑名单 |
| MED-05 | 🟡 | JWT | server/auth.ts:12 | 载荷信息暴露 |
| MED-06 | 🟡 | `POST /api/rules/reactivate` | server.ts:799 | 无授权校验 |
| MED-07 | 🟡 | 全局 | package.json | 依赖未锁定 |
| LOW-01 | 🟢 | 全局 | server.ts | 错误信息泄露 |
| LOW-02 | 🟢 | 登录 | server.ts:332 | 日志泄露用户名 |
| LOW-03 | 🟢 | 前端 | api.ts:2 | localStorage 存 token |
| LOW-04 | 🟢 | 全局 | server.ts | 弱密码策略 |
| LOW-05 | 🟢 | 日志 | logger.ts:36 | 未转义输入 |

---

## 七、修复优先级建议

### 第一优先级（立即修复）

1. **CRIT-01**: `POST /api/tasks/approve` — 从 `reward_rules` 表读取规则的 `points` 值，而非信任客户端
2. **CRIT-02**: `POST /api/redemptions/approve` — 从 `rewards` 表读取 `pointsRequired`
3. **CRIT-03**: `GET /api/users/:id` — 排除 `password` 字段 + 添加家庭校验
4. **CRIT-04/05**: 任务/兑换删除 — 添加家庭 + 角色校验

### 第二优先级（尽快修复）

5. **HIGH-01/02**: Rules/Rewards CRUD — 添加所有权校验
6. **CRIT-06/07/08**: 兑换和查询接口 — 添加家庭边界校验
7. **CRIT-09/10**: 通知和个人资料 — 添加严格授权
8. **HIGH-03**: 任务提交 — 校验 `authUser.id === childId`

### 第三优先级（计划修复）

9. **MED-01**: 添加 HTTP 安全头（helmet）
10. **HIGH-04**: 移除或修改硬编码密码
11. **MED-04**: 实现 Token 黑名单
12. **LOW-04**: 增强密码策略

---

## 八、附录：受影响端点清单

| 方法 | 端点 | 认证 | 授权 | 风险 |
|------|------|------|------|------|
| POST | `/api/login` | 无 | 无 | ✅ 有防爆破 |
| POST | `/api/register/family` | 无 | 无 | ⚠️ 无频率限制 |
| POST | `/api/admin/change-password` | 是 | admin | ✅ |
| GET | `/api/admin/families` | 是 | admin | ✅ |
| DELETE | `/api/admin/families/:id` | 是 | admin | ✅ |
| GET | `/api/admin/logs` | 是 | admin | ✅ |
| POST | `/api/users/update-password` | 是 | 同家庭+非child | ✅ |
| GET | `/api/notifications/:userId` | 是 | **无校验** | 🔴 |
| POST | `/api/notifications/read` | 是 | **无校验** | 🔴 |
| GET | `/api/users` | 是 | 同家庭/admin | ✅ |
| POST | `/api/register/family` | 无 | 无 | ⚠️ |
| POST | `/api/users/add-member` | 是 | 同家庭 | ✅ |
| POST | `/api/users/update-profile` | 是 | 本人/admin | ⚠️ 同家庭可改 |
| DELETE | `/api/users/:id` | 是 | 同家庭+非child | ✅ |
| GET | `/api/users/:id` | 是 | **无校验** | 🔴 泄露密码 |
| GET | `/api/rules/:uid` | 是 | 隐含 | ✅ |
| POST | `/api/rules` | 是 | **无校验** | 🟠 |
| PUT | `/api/rules/:id` | 是 | **无校验** | 🟠 |
| DELETE | `/api/rules/:id` | 是 | **无校验** | 🟠 |
| POST | `/api/rules/reactivate` | 是 | **无校验** | 🟡 |
| GET | `/api/rewards/:uid` | 是 | 隐含 | ✅ |
| POST | `/api/rewards` | 是 | **无校验** | 🟠 |
| PUT | `/api/rewards/:id` | 是 | **无校验** | 🟠 |
| DELETE | `/api/rewards/:id` | 是 | **无校验** | 🟠 |
| POST | `/api/points/add` | 是 | 同家庭+parent | ⚠️ 无规则关联 |
| GET | `/api/tasks/rejected/:childId` | 是 | **无校验** | 🟠 |
| GET | `/api/tasks/all/:childId` | 是 | **无校验** | 🟠 |
| GET | `/api/history/:childId` | 是 | **无校验** | 🟠 |
| GET | `/api/tasks/pending/:uid` | 是 | 隐含 | ✅ |
| POST | `/api/tasks/submit` | 是 | 同家庭 | ⚠️ 可冒充 |
| POST | `/api/tasks/approve` | 是 | 同家庭+parent | 🔴 积分可篡改 |
| POST | `/api/tasks/reject` | 是 | 同家庭+parent | ✅ |
| POST | `/api/redemptions` | 是 | **无校验** | 🔴 |
| GET | `/api/redemptions/:uid` | 是 | 隐含 | ✅ |
| GET | `/api/redemptions/child/:childId` | 是 | **无校验** | 🔴 |
| POST | `/api/redemptions/approve` | 是 | 同家庭+parent | 🔴 扣费可篡改 |
| POST | `/api/redemptions/reject` | 是 | 同家庭+parent | ✅ |
| GET | `/api/stats/:childId` | 是 | **无校验** | 🟠 |
| GET | `/api/growth-history/:parentId` | 是 | **无校验** | 🔴 |
| DELETE | `/api/tasks/:id` | 是 | **无校验** | 🔴 |
| DELETE | `/api/redemptions/:id` | 是 | **无校验** | 🔴 |

> **✅** = 授权逻辑正确
> **⚠️** = 授权逻辑存在瑕疵
> **🔴/🟠/🟡** = 对应严重等级的授权缺失
