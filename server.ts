import express from 'express';
import { createServer } from 'http';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { logAction, getLogs } from './server/logger.js';
import { signToken, verifyToken, hashPassword, comparePassword } from './server/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 确保数据目录存在以实现持久化
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'kiddie_rewards.db');
const db = new Database(dbPath);

// 内存中的暴力破解防护
const loginFailures = new Map<string, { attempts: number, lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const COOLDOWN_PERIOD = 10 * 60 * 1000; // 10分钟

function checkBruteForce(key: string): { blocked: boolean; remaining?: number } {
  const record = loginFailures.get(key);
  if (!record) return { blocked: false };
  
  if (record.attempts >= MAX_ATTEMPTS) {
    const elapsed = Date.now() - record.lastAttempt;
    if (elapsed < COOLDOWN_PERIOD) {
      return { blocked: true, remaining: COOLDOWN_PERIOD - elapsed };
    } else {
      loginFailures.delete(key);
      return { blocked: false };
    }
  }
  return { blocked: false };
}

function recordFailure(key: string) {
  const record = loginFailures.get(key) || { attempts: 0, lastAttempt: 0 };
  record.attempts += 1;
  record.lastAttempt = Date.now();
  loginFailures.set(key, record);
}

function recordSuccess(key: string) {
  loginFailures.delete(key);
}

async function verifyPassword(inputPassword: string, storedPassword: string, userId: string): Promise<boolean> {
  if (!storedPassword) return false;
  // bcrypt hash 以 $2 开头
  if (storedPassword.startsWith('$2')) {
    return comparePassword(inputPassword, storedPassword);
  }
  // 明文密码：直接比对，成功后加密存储
  if (inputPassword === storedPassword) {
    const hashed = await hashPassword(inputPassword);
    try {
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, userId);
      console.log(`[AUTH] Upgraded plaintext password for user ${userId}`);
    } catch (e) {
      console.warn(`[AUTH] Failed to upgrade password for ${userId}:`, e);
    }
    return true;
  }
  return false;
}

// 初始化数据库表
db.exec(`
  CREATE TABLE IF NOT EXISTS families (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    createdAt INTEGER,
    lastActiveAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    familyId TEXT,
    parentId TEXT,
    points INTEGER DEFAULT 0,
    avatar TEXT,
    password TEXT
  );

  CREATE TABLE IF NOT EXISTS reward_rules (
    id TEXT PRIMARY KEY,
    familyId TEXT,
    parentId TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    points INTEGER NOT NULL,
    icon TEXT,
    isRepeating INTEGER DEFAULT 1,
    targetChildId TEXT DEFAULT 'all'
  );

  CREATE TABLE IF NOT EXISTS rewards (
    id TEXT PRIMARY KEY,
    familyId TEXT,
    parentId TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    pointsRequired INTEGER NOT NULL,
    image TEXT,
    targetChildId TEXT DEFAULT 'all'
  );

  CREATE TABLE IF NOT EXISTS redemption_records (
    id TEXT PRIMARY KEY,
    familyId TEXT,
    childId TEXT NOT NULL,
    parentId TEXT NOT NULL,
    rewardId TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    rewardTitle TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS point_history (
    id TEXT PRIMARY KEY,
    childId TEXT NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    type TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS task_submissions (
    id TEXT PRIMARY KEY,
    familyId TEXT,
    childId TEXT NOT NULL,
    parentId TEXT NOT NULL,
    ruleId TEXT NOT NULL,
    title TEXT NOT NULL,
    points INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    rejectionReason TEXT,
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    isRead INTEGER DEFAULT 0,
    metadata TEXT,
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS server_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// 数据库迁移
try { db.exec("ALTER TABLE notifications ADD COLUMN metadata TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE reward_rules ADD COLUMN familyId TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE reward_rules ADD COLUMN isRepeating INTEGER DEFAULT 1"); } catch(e) {}
try { db.exec("ALTER TABLE reward_rules ADD COLUMN targetChildId TEXT DEFAULT 'all'"); } catch(e) {}
try { db.exec("ALTER TABLE rewards ADD COLUMN familyId TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE rewards ADD COLUMN targetChildId TEXT DEFAULT 'all'"); } catch(e) {}
try { db.exec("ALTER TABLE redemption_records ADD COLUMN familyId TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE task_submissions ADD COLUMN familyId TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE families ADD COLUMN createdAt INTEGER"); } catch(e) {}
try { db.exec("ALTER TABLE families ADD COLUMN lastActiveAt INTEGER"); } catch(e) {}

// 填充缺失默认值
try {
  db.prepare("UPDATE families SET createdAt = ? WHERE createdAt IS NULL").run(Date.now());
  db.prepare("UPDATE families SET lastActiveAt = ? WHERE lastActiveAt IS NULL").run(Date.now());
} catch(e) {}

// 为现有记录填充缺失的familyId
try {
  const users = db.prepare("SELECT id, familyId FROM users").all() as any[];
  const updateRule = db.prepare("UPDATE reward_rules SET familyId = ? WHERE parentId = ? AND familyId IS NULL");
  const updateReward = db.prepare("UPDATE rewards SET familyId = ? WHERE parentId = ? AND familyId IS NULL");
  const updateRedemption = db.prepare("UPDATE redemption_records SET familyId = ? WHERE parentId = ? AND familyId IS NULL");
  const updateTask = db.prepare("UPDATE task_submissions SET familyId = ? WHERE parentId = ? AND familyId IS NULL");
  
  users.forEach(u => {
    if (u.familyId) {
      updateRule.run(u.familyId, u.id);
      updateReward.run(u.familyId, u.id);
      updateRedemption.run(u.familyId, u.id);
      updateTask.run(u.familyId, u.id);
    }
  });
} catch(e) {}

try {
  db.exec("ALTER TABLE task_submissions ADD COLUMN rejectionReason TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN password TEXT");
} catch (e) {}

// 异步初始化默认密码（仅对尚未加密的用户），并初始化种子数据
async function initDefaults() {
  // 使用强默认密码（生产环境建议通过环境变量覆盖）
  const defaultPwd = process.env.DEFAULT_PARENT_PASSWORD || 'Kiddie@2026!';
  const adminPwd = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@Kiddie2026!';
  const defaultPwdHash = await hashPassword(defaultPwd);
  const adminPwdHash = await hashPassword(adminPwd);

  try {
    // 迁移旧明文密码 -> bcrypt
    const existingUsers = db.prepare("SELECT id, password FROM users WHERE password IS NOT NULL AND password != ''").all() as any[];
    for (const u of existingUsers) {
      if (!u.password.startsWith('$2')) {
        const pw = u.password as string;
        // 对旧明文密码直接进行 bcrypt 哈希，保留用户原始密码
        const hashed = await hashPassword(pw);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, u.id);
      }
    }

    const initTransaction = db.transaction(() => {
      // 初始化管理员（如果不存在）
      const existingAdmin = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
      if (!existingAdmin) {
        db.prepare('INSERT INTO users (id, name, role, points, password) VALUES (?, ?, ?, ?, ?)').run('admin-sys-001', 'admin', 'admin', 0, adminPwdHash);
      }

      const isSeeded = db.prepare('SELECT value FROM server_meta WHERE key = ?').get('seeded');
      if (!isSeeded) {
        // 强制重置示例家庭（仅首次启动时）
        db.prepare('DELETE FROM families WHERE name = ?').run('乐家');
        const famId = 'fam_le';
        db.prepare('INSERT INTO families (id, name, createdAt, lastActiveAt) VALUES (?, ?, ?, ?)').run(famId, '乐家', Date.now(), Date.now());

        db.prepare('DELETE FROM users WHERE name = ? AND familyId = ?').run('乐爸/乐妈', famId);
        db.prepare('DELETE FROM users WHERE name = ? AND familyId = ?').run('小乐', famId);

        const pId = 'demo-p-001';
        db.prepare('INSERT OR REPLACE INTO users (id, name, role, points, password, familyId) VALUES (?, ?, ?, ?, ?, ?)').run(pId, '乐爸/乐妈', 'parent', 0, defaultPwdHash, famId);
        db.prepare('INSERT OR REPLACE INTO users (id, name, role, parentId, points, password, familyId) VALUES (?, ?, ?, ?, ?, ?, ?)').run('demo-c-001', '小乐', 'child', pId, 100, defaultPwdHash, famId);

        // 初始规则/奖励
        db.prepare('DELETE FROM reward_rules WHERE parentId = ?').run(pId);
        db.prepare('INSERT OR IGNORE INTO reward_rules (id, parentId, title, points, icon) VALUES (?, ?, ?, ?, ?)').run('r1', pId, '按时完成作业', 10, 'Book');
        db.prepare('INSERT OR IGNORE INTO reward_rules (id, parentId, title, points, icon) VALUES (?, ?, ?, ?, ?)').run('r2', pId, '自己整理房间', 5, 'Home');

        db.prepare('DELETE FROM rewards WHERE parentId = ?').run(pId);
        db.prepare('INSERT OR IGNORE INTO rewards (id, parentId, title, pointsRequired) VALUES (?, ?, ?, ?)').run('rew1', pId, '额外的30分钟游戏时间', 50);
        db.prepare('INSERT OR IGNORE INTO rewards (id, parentId, title, pointsRequired) VALUES (?, ?, ?, ?)').run('rew2', pId, '周末去游乐场', 200);

        db.prepare('INSERT INTO server_meta (key, value) VALUES (?, ?)').run('seeded', 'true');
      }
    });

    initTransaction();
    console.log('[INIT] Hierarchical Database Sync OK.');
  } catch (e) {
    console.error("[INIT] Hierarchical Sync Error:", e);
  }
}

// MED-04: Token 黑名单（模块级，供 authMiddleware 和 /api/logout 共享）
const tokenBlacklist = new Set<string>();

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未登录或登录已过期' });
  }
  try {
    const token = authHeader.substring(7);
    // MED-04: 检查 Token 是否在黑名单
    if (tokenBlacklist.has(token)) {
      return res.status(401).json({ success: false, message: '该登录已失效' });
    }
    const decoded = verifyToken(token);
    (req as any).authUser = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: '无效的认证令牌' });
  }
}

function adminOnlyMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authUser = (req as any).authUser;
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ success: false, message: '需要管理员权限' });
  }
  next();
}

async function startServer() {
  await initDefaults();

  const app = express();
  const httpServer = createServer(app);

  // 信任代理，在Docker/反向代理后获取真实IP
  app.set('trust proxy', true);

  // MED-01: HTTP 安全头
  app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // CSP: 允许同源资源 + 字体/图片（包括外部图床等）+ Vite HMR WebSocket
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http:; font-src 'self' data:; connect-src 'self' http: https:");
    next();
  });

  app.use(express.json());

  // 提取真实客户端IP的辅助函数，特别是Cloudflare Tunnel/Docker Bridge后面
  const getClientIp = (req: express.Request) => {
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string') return cfIp;
    
    // Express req.ip在设置信任代理后已处理X-Forwarded-For
    return req.ip || '-';
  };

  // 请求日志，用于调试
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
  });

  // 注销登录（MED-04：Token 黑名单）
  app.post('/api/logout', authMiddleware, (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      tokenBlacklist.add(token);
    }
    res.json({ success: true });
  });

  // MED-02: CSRF 保护中间件 — 对非安全方法校验 Origin/Referer
  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://localhost:3000',
    'https://kr.gxbs.cn',
    ...((process.env.SOCKET_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean))
  ]);
  function csrfMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const origin = req.headers.origin;
      const referer = req.headers.referer;
      const checkOrigin = (url: string) => {
        try {
          const u = new URL(url);
          const originStr = `${u.protocol}//${u.host}`;
          // 放行静态允许的 Origin
          if (allowedOrigins.has(originStr)) return true;
          // 同源请求自动放行（前后端同一服务，Origin hostname 与 req.hostname 一致即合法）
          if (req.hostname && u.hostname.toLowerCase() === req.hostname.toLowerCase()) return true;
          return false;
        } catch {
          return false;
        }
      };
      if (origin && !checkOrigin(origin)) {
        return res.status(403).json({ success: false, message: 'CSRF 校验失败' });
      }
      if (!origin && referer && !checkOrigin(referer)) {
        return res.status(403).json({ success: false, message: 'CSRF 校验失败' });
      }
    }
    next();
  }

  // 挂载 CSRF 中间件到所有 API 路由之前
  app.use(csrfMiddleware);

  // 健康检查
  app.get('/api/health', (req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ok' });
    } catch (e) {
      res.status(500).json({ status: 'error' });
    }
  });

  // 通用登录接口，支持User@Family格式
  // MED-03: 注册频率限制
  const registerAttempts = new Map<string, { count: number, lastReset: number }>();
  const REGISTER_MAX_PER_MINUTE = 5;
  function checkRegisterRate(ip: string): boolean {
    const key = ip;
    const record = registerAttempts.get(key);
    const now = Date.now();
    if (!record || (now - record.lastReset) > 60_000) {
      registerAttempts.set(key, { count: 1, lastReset: now });
      return true;
    }
    if (record.count >= REGISTER_MAX_PER_MINUTE) {
      return false;
    }
    record.count++;
    return true;
  }

  app.post('/api/login', async (req, res) => {
    const { name, password } = req.body;
    const ip = getClientIp(req);
    
    const clientKey = `${ip}:${name}`;
    const bfStatus = checkBruteForce(clientKey);
    if (bfStatus.blocked) {
      const minutes = Math.ceil(bfStatus.remaining! / 60000);
      logAction({
        level: 'SECURITY',
        action: 'LOGIN_BLOCKED',
        details: `Brute force attempt detected for ${name} from ${ip}`,
        success: false,
        ip
      });
      return res.status(429).json({ success: false, message: `登录尝试过多，请在 ${minutes} 分钟后再试` });
    }

    console.log(`[AUTH DEBUG] Login attempt: [${name}]`);
    
    // 1. Super Admin检查
    if (name.toLowerCase() === 'admin') {
      const admin = db.prepare("SELECT * FROM users WHERE role = 'admin' AND name = 'admin'").get() as any;
      if (admin && await verifyPassword(password, admin.password, admin.id)) {
        recordSuccess(clientKey);
        const token = signToken({ id: admin.id, name: admin.name, role: admin.role, familyId: admin.familyId, parentId: admin.parentId });
        logAction({
          level: 'INFO',
          action: 'LOGIN_SUCCESS',
          userId: admin.id,
          userName: admin.name,
          details: 'Super Admin login success',
          success: true,
          ip
        });
        return res.json({ success: true, token, user: { id: admin.id, name: admin.name, role: admin.role } });
      }
      recordFailure(clientKey);
      logAction({
        level: 'WARN',
        action: 'LOGIN_FAILED',
        userName: 'admin',
        details: 'Admin login failed - incorrect password',
        success: false,
        ip
      });
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    // 2. User@Family检查
    if (!name.includes('@')) {
      return res.status(400).json({ success: false, message: '请输入格式如 名称@家庭 的账号' });
    }

    const [username, familyName] = name.split('@');
    
    // 查找家庭
    const family = db.prepare("SELECT id FROM families WHERE LOWER(name) = LOWER(?)").get(familyName) as any;
    if (!family) {
      recordFailure(clientKey);
      logAction({
        level: 'WARN',
        action: 'LOGIN_FAILED',
        userName: name,
        details: `Family not found: ${familyName}`,
        success: false,
        ip
      });
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    // 查找家庭中的用户
    const user = db.prepare("SELECT * FROM users WHERE LOWER(name) = LOWER(?) AND familyId = ?").get(username, family.id) as any;
    
    if (!user) {
      recordFailure(clientKey);
      logAction({
        level: 'WARN',
        action: 'LOGIN_FAILED',
        userName: name,
        familyId: family.id,
        details: `User not found in family: ${username}`,
        success: false,
        ip
      });
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const passwordValid = await verifyPassword(password, user.password || '', user.id);
    if (!passwordValid) {
      recordFailure(clientKey);
      logAction({
        level: 'WARN',
        action: 'LOGIN_FAILED',
        userId: user.id,
        userName: name,
        familyId: family.id,
        details: `Incorrect password for user ${username}`,
        success: false,
        ip
      });
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    recordSuccess(clientKey);
    try {
      db.prepare('UPDATE families SET lastActiveAt = ? WHERE id = ?').run(Date.now(), family.id);
    } catch(e) {}

    const token = signToken({ id: user.id, name: user.name, role: user.role, familyId: user.familyId, parentId: user.parentId });

    logAction({
      level: 'INFO',
      action: 'LOGIN_SUCCESS',
      userId: user.id,
      userName: name,
      familyId: family.id,
      details: `User ${name} logged in successfully`,
      success: true,
      ip
    });
    res.json({ success: true, token, user: { id: user.id, name: user.name, role: user.role, parentId: user.parentId, familyId: user.familyId } });
  });

  // Admin: 修改密码
  app.post('/api/admin/change-password', authMiddleware, adminOnlyMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const admin = db.prepare("SELECT * FROM users WHERE role = 'admin' AND name = 'admin'").get() as any;
    
    if (!admin || !(await verifyPassword(currentPassword, admin.password, admin.id))) {
      return res.status(401).json({ success: false, error: '当前密码错误' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: '新密码至少6位' });
    }

    const hashedPassword = await hashPassword(newPassword);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, admin.id);
    
    logAction({
      level: 'SECURITY',
      action: 'ADMIN_PASSWORD_CHANGE',
      userName: 'admin',
      details: 'Super Admin changed their password',
      success: true,
      ip: getClientIp(req)
    });

    res.json({ success: true });
  });

  // Admin: 获取所有家庭及其成员
  app.get('/api/admin/families', authMiddleware, adminOnlyMiddleware, (req, res) => {
    const fams = db.prepare("SELECT * FROM families").all();
    const users = db.prepare("SELECT id, name, role, parentId, familyId, points FROM users").all();
    
    const results = fams.map((f: any) => ({
      ...f,
      parents: users.filter((u: any) => u.familyId === f.id && u.role === 'parent'),
      children: users.filter((u: any) => u.familyId === f.id && u.role === 'child')
    }));
    
    res.json(results);
  });

  // Admin: 删除家庭
  app.delete('/api/admin/families/:id', authMiddleware, adminOnlyMiddleware, (req, res) => {
    const familyId = req.params.id;
    console.log(`[ADMIN] Attempting to delete family: ${familyId}`);
    
    try {
      const trx = db.transaction(() => {
        // 1. 清除直接包含familyId的表
        db.prepare('DELETE FROM reward_rules WHERE familyId = ?').run(familyId);
        db.prepare('DELETE FROM rewards WHERE familyId = ?').run(familyId);
        db.prepare('DELETE FROM task_submissions WHERE familyId = ?').run(familyId);
        db.prepare('DELETE FROM redemption_records WHERE familyId = ?').run(familyId);

        // 2. 获取所有家庭成员以清除旧版/用户绑定表
        const users = db.prepare('SELECT id FROM users WHERE familyId = ?').all(familyId) as { id: string }[];
        const userIds = users.map(u => u.id);

        if (userIds.length > 0) {
          const placeholders = userIds.map(() => '?').join(',');
          try {
            db.prepare(`DELETE FROM point_history WHERE childId IN (${placeholders})`).run(...userIds);
            db.prepare(`DELETE FROM notifications WHERE userId IN (${placeholders})`).run(...userIds);
          } catch(e) {
            console.error("Cleanup legacy explicit tables non-fatal mapping:", e);
          }
        }
        
        // 确保迁移前创建的旧版奖励规则或任务提交也会被清理
        if (userIds.length > 0) {
          const placeholders = userIds.map(() => '?').join(',');
          try {
            db.prepare(`DELETE FROM reward_rules WHERE parentId IN (${placeholders})`).run(...userIds);
            db.prepare(`DELETE FROM rewards WHERE parentId IN (${placeholders})`).run(...userIds);
            db.prepare(`DELETE FROM task_submissions WHERE childId IN (${placeholders}) OR parentId IN (${placeholders})`).run(...userIds, ...userIds);
            db.prepare(`DELETE FROM redemption_records WHERE childId IN (${placeholders}) OR parentId IN (${placeholders})`).run(...userIds, ...userIds);
          } catch(e) {}
        }

        // 3. 清除用户
        db.prepare('DELETE FROM users WHERE familyId = ?').run(familyId);

        // 4. 最后清除家庭
        db.prepare('DELETE FROM families WHERE id = ?').run(familyId);
      });
      
      trx();
      logAction({
        level: 'SECURITY',
        action: 'DELETE_FAMILY',
        familyId,
        details: `Super Admin deleted family ${familyId}`,
        success: true,
        ip: getClientIp(req)
      });
      res.json({ success: true });
    } catch (e) {
      logAction({
        level: 'ERROR',
        action: 'DELETE_FAMILY',
        familyId,
        details: `Error deleting family: ${(e as Error).message}`,
        success: false,
        ip: getClientIp(req)
      });
      res.status(500).json({ success: false, error: '操作失败，请稍后重试' });
    }
  });

  // Admin日志API
  app.get('/api/admin/logs', authMiddleware, adminOnlyMiddleware, (req, res) => {
    const { year, month } = req.query;
    try {
      const logs = getLogs(year as string, month as string);
      res.json(logs.slice(0, 500)); // Limit to first 500 logs for UI performance
    } catch (e) {
      res.status(500).json({ error: '获取日志失败' });
    }
  });

  app.post('/api/users/update-password', authMiddleware, async (req, res) => {
    const { userId, newPassword } = req.body;
    const authUser = (req as any).authUser;
    try {
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: '密码至少需要6位' });
      }
      const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (!targetUser || targetUser.familyId !== authUser.familyId || authUser.role === 'child') {
        return res.status(403).json({ success: false, message: '无权限修改该用户密码' });
      }
      const hashedPassword = await hashPassword(newPassword);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, message: '更新密码失败' });
    }
  });

  // API路由
  app.get('/api/notifications/:userId', authMiddleware, (req, res) => {
    const authUser = (req as any).authUser;
    const targetUserId = req.params.userId;
    if (authUser.role !== 'admin' && authUser.id !== targetUserId) {
      return res.status(403).json({ success: false, message: '无权限查看该通知' });
    }
    const notifications = db.prepare('SELECT * FROM notifications WHERE userId = ? ORDER BY timestamp DESC LIMIT 20').all(targetUserId);
    res.json(notifications);
  });

  app.post('/api/notifications/read', authMiddleware, (req, res) => {
    const { userId } = req.body;
    const authUser = (req as any).authUser;
    if (authUser.role !== 'admin' && authUser.id !== userId) {
      return res.status(403).json({ success: false, message: '无权限操作该通知' });
    }
    db.prepare('UPDATE notifications SET isRead = 1 WHERE userId = ?').run(userId);
    res.json({ success: true });
  });

  app.get('/api/users', authMiddleware, (req, res) => {
    const authUser = (req as any).authUser;
    if (authUser.role === 'admin') {
      const users = db.prepare('SELECT id, name, role, parentId, familyId, points, avatar FROM users').all();
      return res.json(users);
    }
    const users = db.prepare('SELECT id, name, role, parentId, familyId, points, avatar FROM users WHERE familyId = ?').all(authUser.familyId);
    res.json(users);
  });

  app.post('/api/register/family', async (req, res) => {
    const { familyName, adminName, password } = req.body;
    const ip = getClientIp(req);

    // MED-03: 频率限制
    if (!checkRegisterRate(ip)) {
      return res.status(429).json({ success: false, message: '注册过于频繁，请稍后再试' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: '密码至少需要6位' });
    }
    const famId = 'fam_' + Math.random().toString(36).substr(2, 9);
    const pId = 'p_' + Math.random().toString(36).substr(2, 9);
    const hashedPassword = await hashPassword(password);
    
    try {
      const trx = db.transaction(() => {
        db.prepare('INSERT INTO families (id, name, createdAt, lastActiveAt) VALUES (?, ?, ?, ?)').run(famId, familyName, Date.now(), Date.now());
        db.prepare('INSERT INTO users (id, name, role, points, password, familyId) VALUES (?, ?, ?, ?, ?, ?)').run(pId, adminName, 'parent', 0, hashedPassword, famId);
      });
      trx();
      logAction({
        level: 'INFO',
        action: 'REGISTER_FAMILY',
        familyId: famId,
        userName: adminName,
        details: `New family registered: ${familyName}`,
        success: true,
        ip: getClientIp(req)
      });
      res.json({ success: true, user: { id: pId, name: adminName, role: 'parent', familyId: famId } });
    } catch (e) {
      logAction({
        level: 'ERROR',
        action: 'REGISTER_FAMILY',
        details: `Registration failed for ${familyName}: ${(e as Error).message}`,
        success: false,
        ip: getClientIp(req)
      });
      res.status(500).json({ success: false, message: '注册失败，请稍后重试' });
    }
  });

  app.post('/api/users/add-member', authMiddleware, async (req, res) => {
    const { name, parentId, password, role } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: '密码至少需要6位' });
    }
    const parent = db.prepare('SELECT familyId FROM users WHERE id = ?').get(parentId) as any;
    const authUser = (req as any).authUser;
    if (!parent || parent.familyId !== authUser.familyId) {
      return res.status(403).json({ success: false, message: '无权限添加成员到此家庭' });
    }
    const id = (role === 'parent' ? 'p_' : 'c_') + Math.random().toString(36).substr(2, 9);
    const hashedPassword = await hashPassword(password);
    try {
      db.prepare('INSERT INTO users (id, name, role, parentId, points, familyId, password) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, name, role || 'child', parentId, 0, parent.familyId, hashedPassword);
      
      logAction({
        level: 'INFO',
        action: 'ADD_MEMBER',
        userId: parentId,
        userName: parentId,
        familyId: parent.familyId,
        details: `Added new member: ${name} (${role || 'child'})`,
        success: true,
        ip: getClientIp(req)
      });
      res.json({ success: true, user: { id, name, role: role || 'child', parentId, familyId: parent.familyId } });
    } catch (e) {
      logAction({
        level: 'ERROR',
        action: 'ADD_MEMBER',
        userId: parentId,
        details: `Failed to add member ${name}: ${(e as Error).message}`,
        success: false,
        ip: getClientIp(req)
      });
      res.status(500).json({ success: false, message: '添加失败' });
    }
  });

  app.post('/api/users/update-profile', authMiddleware, async (req, res) => {
    const { userId, name, password } = req.body;
    const authUser = (req as any).authUser;
    try {
      const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (!targetUser) {
        return res.status(404).json({ success: false, message: '用户不存在' });
      }
      // 仅本人或 admin 可修改，且禁止修改密码
      if (authUser.role !== 'admin' && authUser.id !== userId) {
        return res.status(403).json({ success: false, message: '无权限修改该用户资料' });
      }
      if (authUser.role !== 'admin' && password) {
        return res.status(403).json({ success: false, message: '请使用专门接口修改密码' });
      }
      if (password && password.length < 6) {
        return res.status(400).json({ success: false, message: '密码至少需要6位' });
      }
      if (password) {
        const hashedPassword = await hashPassword(password);
        db.prepare('UPDATE users SET name = ?, password = ? WHERE id = ?').run(name, hashedPassword, userId);
      } else {
        db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, userId);
      }
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, message: '更新失败' });
    }
  });

  // 通用用户删除（孩子或家长）
  app.delete('/api/users/:id', authMiddleware, (req, res) => {
    const userId = req.params.id;
    const authUser = (req as any).authUser;
    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!targetUser || targetUser.familyId !== authUser.familyId || authUser.role === 'child') {
      return res.status(403).json({ success: false, message: '无权限删除该用户' });
    }
    try {
      const trx = db.transaction(() => {
        // 清理所有可能的关联记录
        db.prepare('DELETE FROM redemption_records WHERE childId = ?').run(userId);
        db.prepare('DELETE FROM point_history WHERE childId = ?').run(userId);
        db.prepare('DELETE FROM task_submissions WHERE childId = ?').run(userId);
        db.prepare('DELETE FROM notifications WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      });
      trx();
      logAction({
        level: 'SECURITY',
        action: 'DELETE_USER',
        userId,
        details: `User deleted: ${userId}`,
        success: true
      });
      res.json({ success: true });
    } catch (e) {
      logAction({
        level: 'ERROR',
        action: 'DELETE_USER',
        userId,
        details: `Failed to delete user: ${(e as Error).message}`,
        success: false
      });
      res.status(500).json({ success: false, message: '删除成员失败' });
    }
  });

  // 保留旧接口以兼容，直接指向新逻辑
  app.delete('/api/users/child/:id', authMiddleware, (req, res) => {
    res.redirect(307, `/api/users/${req.params.id}`);
  });

  app.get('/api/users/:id', authMiddleware, (req, res) => {
    const authUser = (req as any).authUser;
    const user = db.prepare('SELECT id, name, role, parentId, familyId, points, avatar FROM users WHERE id = ?').get(req.params.id) as any;
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    if (authUser.role !== 'admin' && user.familyId !== authUser.familyId) {
      return res.status(403).json({ success: false, message: '无权限查看该用户' });
    }
    res.json(user);
  });

  app.get('/api/rules/:uid', authMiddleware, (req, res) => {
    const user = db.prepare('SELECT role, familyId FROM users WHERE id = ?').get(req.params.uid) as any;
    if (!user) return res.json([]);
    let rules = db.prepare('SELECT * FROM reward_rules WHERE familyId = ? OR parentId = ?').all(user.familyId, req.params.uid);
    if (user.role === 'child') {
      rules = rules.filter((r: any) => !r.targetChildId || r.targetChildId === 'all' || r.targetChildId === req.params.uid);
    }
    res.json(rules.map((r: any) => ({ ...r, isRepeating: !!r.isRepeating })));
  });

  app.post('/api/rules', authMiddleware, (req, res) => {
    const { id, parentId, title, points, icon, description, isRepeating, targetChildId } = req.body;
    const authUser = (req as any).authUser;
    if (authUser.role !== 'admin' && authUser.id !== parentId) {
      return res.status(403).json({ success: false, message: '无权限创建规则' });
    }
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(parentId) as any;
    if (!user || (authUser.role !== 'admin' && user.familyId !== authUser.familyId)) {
      return res.status(403).json({ success: false, message: '无权限创建规则' });
    }
    try {
      db.prepare('INSERT INTO reward_rules (id, parentId, title, points, icon, description, familyId, isRepeating, targetChildId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, parentId, title, points, icon, description, user?.familyId, isRepeating ? 1 : 0, targetChildId || 'all');
      logAction({
        level: 'INFO',
        action: 'CREATE_RULE',
        userId: parentId,
        familyId: user?.familyId,
        details: `Created rule: ${title}`,
        success: true
      });
      res.status(201).json({ success: true });
    } catch (e) {
      logAction({
        level: 'ERROR',
        action: 'CREATE_RULE',
        userId: parentId,
        details: `Failed to create rule: ${(e as Error).message}`,
        success: false
      });
      res.status(500).json({ success: false, message: '创建失败' });
    }
  });

  app.put('/api/rules/:id', authMiddleware, (req, res) => {
    const { title, points, icon, description, isRepeating, targetChildId } = req.body;
    const authUser = (req as any).authUser;
    const rule = db.prepare('SELECT familyId FROM reward_rules WHERE id = ?').get(req.params.id) as any;
    if (!rule || (authUser.role !== 'admin' && rule.familyId !== authUser.familyId)) {
      return res.status(403).json({ success: false, message: '无权限修改该规则' });
    }
    db.prepare('UPDATE reward_rules SET title = ?, points = ?, icon = ?, description = ?, isRepeating = ?, targetChildId = ? WHERE id = ?')
      .run(title, points, icon, description, isRepeating ? 1 : 0, targetChildId || 'all', req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/rules/:id', authMiddleware, (req, res) => {
    const authUser = (req as any).authUser;
    const rule = db.prepare('SELECT familyId FROM reward_rules WHERE id = ?').get(req.params.id) as any;
    if (!rule || (authUser.role !== 'admin' && rule.familyId !== authUser.familyId)) {
      return res.status(403).json({ success: false, message: '无权限删除该规则' });
    }
    db.prepare('DELETE FROM reward_rules WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/rules/reactivate', authMiddleware, (req, res) => {
    const { ruleId, childId } = req.body;
    const authUser = (req as any).authUser;
    const rule = db.prepare('SELECT familyId FROM reward_rules WHERE id = ?').get(ruleId) as any;
    if (!rule || (authUser.role !== 'admin' && rule.familyId !== authUser.familyId)) {
      return res.status(403).json({ success: false, message: '无权限操作该规则' });
    }
    try {
      // 归档此孩子在此规则下已批准的提交，以便可以重新提交
      db.prepare("UPDATE task_submissions SET status = 'archived' WHERE ruleId = ? AND childId = ? AND status = 'approved'").run(ruleId, childId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Reactivation failed' });
    }
  });

  app.get('/api/rewards/:uid', authMiddleware, (req, res) => {
    const user = db.prepare('SELECT role, familyId FROM users WHERE id = ?').get(req.params.uid) as any;
    if (!user) return res.json([]);
    let rewards = db.prepare('SELECT * FROM rewards WHERE familyId = ? OR parentId = ?').all(user.familyId, req.params.uid);
    if (user.role === 'child') {
      rewards = rewards.filter((r: any) => !r.targetChildId || r.targetChildId === 'all' || r.targetChildId === req.params.uid);
    }
    res.json(rewards);
  });

  app.post('/api/rewards', authMiddleware, (req, res) => {
    const { id, parentId, title, pointsRequired, description, targetChildId } = req.body;
    const authUser = (req as any).authUser;
    if (authUser.role !== 'admin' && authUser.id !== parentId) {
      return res.status(403).json({ success: false, message: '无权限创建奖励' });
    }
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(parentId) as any;
    if (!user || (authUser.role !== 'admin' && user.familyId !== authUser.familyId)) {
      return res.status(403).json({ success: false, message: '无权限创建奖励' });
    }
    db.prepare('INSERT INTO rewards (id, parentId, title, pointsRequired, description, familyId, targetChildId) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, parentId, title, pointsRequired, description, user?.familyId, targetChildId || 'all');
    res.status(201).json({ success: true });
  });

  app.put('/api/rewards/:id', authMiddleware, (req, res) => {
    const { title, pointsRequired, description, targetChildId } = req.body;
    const authUser = (req as any).authUser;
    const reward = db.prepare('SELECT familyId FROM rewards WHERE id = ?').get(req.params.id) as any;
    if (!reward || (authUser.role !== 'admin' && reward.familyId !== authUser.familyId)) {
      return res.status(403).json({ success: false, message: '无权限修改该奖励' });
    }
    db.prepare('UPDATE rewards SET title = ?, pointsRequired = ?, description = ?, targetChildId = ? WHERE id = ?')
      .run(title, pointsRequired, description, targetChildId || 'all', req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/rewards/:id', authMiddleware, (req, res) => {
    const authUser = (req as any).authUser;
    const reward = db.prepare('SELECT familyId FROM rewards WHERE id = ?').get(req.params.id) as any;
    if (!reward || (authUser.role !== 'admin' && reward.familyId !== authUser.familyId)) {
      return res.status(403).json({ success: false, message: '无权限删除该奖励' });
    }
    db.prepare('DELETE FROM rewards WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/points/add', authMiddleware, (req, res) => {
    const { childId, amount, reason } = req.body;
    const authUser = (req as any).authUser;
    const child = db.prepare('SELECT * FROM users WHERE id = ?').get(childId) as any;
    if (!child || child.familyId !== authUser.familyId || authUser.role === 'child') {
      return res.status(403).json({ success: false, message: '无权限操作积分' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, message: '积分数量无效' });
    }
    const historyId = Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();
    const trx = db.transaction(() => {
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(amount, childId);
      db.prepare('INSERT INTO point_history (id, childId, amount, reason, timestamp, type) VALUES (?, ?, ?, ?, ?, ?)')
        .run(historyId, childId, amount, `手动添加 by ${authUser.name}${reason ? ' - ' + reason : ''}`, timestamp, 'manual_add');
    });
    trx();
    res.json({ success: true });
  });

  app.get('/api/tasks/rejected/:childId', authMiddleware, (req, res) => {
    const authUser = (req as any).authUser;
    const child = db.prepare('SELECT familyId FROM users WHERE id = ?').get(req.params.childId) as any;
    if (!child || (authUser.role !== 'admin' && child.familyId !== authUser.familyId)) {
      return res.status(403).json({ success: false, message: '无权限查看该数据' });
    }
    const tasks = db.prepare("SELECT * FROM task_submissions WHERE childId = ? AND status = 'rejected' ORDER BY timestamp DESC LIMIT 5").all(req.params.childId);
    res.json(tasks);
  });

  app.get('/api/tasks/all/:childId', authMiddleware, (req, res) => {
    const authUser = (req as any).authUser;
    const childId = req.params.childId;
    // childId 可能为 'all'（家长查看所有孩子），不做单用户校验
    if (childId !== 'all') {
      const child = db.prepare('SELECT familyId FROM users WHERE id = ?').get(childId) as any;
      if (!child || (authUser.role !== 'admin' && child.familyId !== authUser.familyId)) {
        return res.status(403).json({ success: false, message: '无权限查看该数据' });
      }
    }
    const tasks = db.prepare('SELECT * FROM task_submissions WHERE childId = ?').all(childId);
    res.json(tasks);
  });

  app.get('/api/history/:childId', authMiddleware, (req, res) => {
    const authUser = (req as any).authUser;
    const child = db.prepare('SELECT familyId FROM users WHERE id = ?').get(req.params.childId) as any;
    if (!child || (authUser.role !== 'admin' && child.familyId !== authUser.familyId)) {
      return res.status(403).json({ success: false, message: '无权限查看该数据' });
    }
    const history = db.prepare('SELECT * FROM point_history WHERE childId = ? ORDER BY timestamp DESC').all(req.params.childId);
    res.json(history);
  });

  app.get('/api/tasks/pending/:uid', authMiddleware, (req, res) => {
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(req.params.uid) as any;
    if (!user) return res.json([]);
    const tasks = db.prepare("SELECT * FROM task_submissions WHERE (familyId = ? OR parentId = ?) AND status = 'pending' ORDER BY timestamp DESC").all(user.familyId, req.params.uid);
    res.json(tasks);
  });

  app.post('/api/tasks/submit', authMiddleware, (req, res) => {
    const { id, childId, parentId, ruleId, title, points } = req.body;
    const authUser = (req as any).authUser;
    // 校验提交者必须是本人（child 角色）
    if (authUser.role !== 'admin' && authUser.id !== childId) {
      return res.status(403).json({ success: false, message: '只能提交自己的任务' });
    }
    const child = db.prepare('SELECT familyId FROM users WHERE id = ?').get(childId) as any;
    if (!child || child.familyId !== authUser.familyId) {
      return res.status(403).json({ success: false, message: '无权限提交任务' });
    }
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(parentId) as any;
    if (!user || user.familyId !== child.familyId) {
      return res.status(400).json({ success: false, message: '家长与孩子不在同一家庭' });
    }
    const timestamp = Date.now();

    // 检查规则限制
    const rule = db.prepare('SELECT isRepeating FROM reward_rules WHERE id = ?').get(ruleId) as any;
    if (rule) {
      if (rule.isRepeating === 0 || rule.isRepeating === false) {
        // 特别规则（一次性）：检查是否已提交且为活跃状态
        const existing = db.prepare("SELECT id FROM task_submissions WHERE childId = ? AND ruleId = ? AND status IN ('pending', 'approved')").get(childId, ruleId);
        if (existing) {
          return res.status(400).json({ success: false, error: '这个任务是一次性的，你已经完成过啦！' });
        }
      } else {
        // 日常规则：检查是否今天已提交且为活跃状态
        const startOfDay = new Date().setHours(0, 0, 0, 0);
        const existingToday = db.prepare("SELECT id FROM task_submissions WHERE childId = ? AND ruleId = ? AND timestamp >= ? AND status IN ('pending', 'approved')").get(childId, ruleId, startOfDay);
        if (existingToday) {
          return res.status(400).json({ success: false, error: '这个任务每天只能领一次，明天再来吧！' });
        }
      }
    }

    db.prepare('INSERT INTO task_submissions (id, childId, parentId, ruleId, title, points, timestamp, status, familyId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, childId, parentId, ruleId, title, points, timestamp, 'pending', user?.familyId);
    
    // 同时为家长保存持久化通知（任务提交）

    res.json({ success: true });
  });

  app.post('/api/tasks/approve', authMiddleware, (req, res) => {
    const { id, childId, title } = req.body;
    const authUser = (req as any).authUser;
    const child = db.prepare('SELECT familyId FROM users WHERE id = ?').get(childId) as any;
    if (!child || child.familyId !== authUser.familyId || authUser.role === 'child') {
      return res.status(403).json({ success: false, message: '无权限审批任务' });
    }

    // 从数据库获取任务的真实积分值，不信任客户端传入的值
    const task = db.prepare('SELECT ruleId, points FROM task_submissions WHERE id = ?').get(id) as any;
    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    const points = task.points;
    const historyId = Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();

    try {
      const trx = db.transaction(() => {
        let isAchievement = false;
        let ruleId = task.ruleId;

        const rule = db.prepare('SELECT isRepeating FROM reward_rules WHERE id = ?').get(ruleId) as any;
        if (rule && (rule.isRepeating === 0 || rule.isRepeating === false)) {
          isAchievement = true;
        }

        db.prepare("UPDATE task_submissions SET status = 'approved' WHERE id = ?").run(id);
        db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(points, childId);
        db.prepare('INSERT INTO point_history (id, childId, amount, reason, timestamp, type) VALUES (?, ?, ?, ?, ?, ?)')
          .run(historyId, childId, points, title, timestamp, 'earn');

        const notifId = Math.random().toString(36).substr(2, 9);
        const notifType = isAchievement ? 'achievement_granted' : 'success';
        const notifMetadata = isAchievement ? JSON.stringify({ ruleId, title }) : null;

        db.prepare('INSERT INTO notifications (id, userId, title, message, type, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(notifId, childId, isAchievement ? '成就解锁！' : '任务已通过！', isAchievement ? `恭喜你达成了特别成就："${title}"！继续保持哦！` : `你的任务"${title}"已获得 ${points} 星币奖励！继续加油哦！`, notifType, timestamp, notifMetadata);
      });
      trx();

      logAction({
        level: 'INFO',
        action: 'TASK_APPROVED',
        userId: childId,
        details: `Approved task: ${title} (${points} pts) for ${childId}`,
        success: true
      });

      res.json({ success: true });
    } catch (e) {
      logAction({
        level: 'ERROR',
        action: 'TASK_APPROVED',
        details: `Failed to approve task ${id}: ${(e as Error).message}`,
        success: false
      });
      res.status(500).json({ success: false, error: '操作失败，请稍后重试' });
    }
  });

  app.post('/api/tasks/reject', authMiddleware, (req, res) => {
    const { id, childId, title, rejectionReason } = req.body;
    const authUser = (req as any).authUser;
    const child = db.prepare('SELECT familyId FROM users WHERE id = ?').get(childId) as any;
    if (!child || child.familyId !== authUser.familyId || authUser.role === 'child') {
      return res.status(403).json({ success: false, message: '无权限拒绝任务' });
    }
    const timestamp = Date.now();
    try {
      db.prepare("UPDATE task_submissions SET status = 'rejected', rejectionReason = ? WHERE id = ?").run(rejectionReason, id);
      
      const notifId = Math.random().toString(36).substr(2, 9);
      db.prepare('INSERT INTO notifications (id, userId, title, message, type, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(notifId, childId, '任务需要调整', `任务"${title}"暂时没通过。爸爸妈妈说：${rejectionReason}`, 'error', timestamp, JSON.stringify({ type: 'task_rejected', taskId: id, title }));

      logAction({
        level: 'INFO',
        action: 'TASK_REJECTED',
        userId: childId,
        details: `Rejected task: ${title} for ${childId}. Reason: ${rejectionReason}`,
        success: true
      });

      res.json({ success: true });
    } catch (e) {
      logAction({
        level: 'ERROR',
        action: 'TASK_REJECTED',
        details: `Failed to reject task ${id}: ${(e as Error).message}`,
        success: false
      });
      res.status(500).json({ success: false, error: '操作失败，请稍后重试' });
    }
  });

  app.post('/api/redemptions', authMiddleware, (req, res) => {
    const { id, childId, parentId, rewardId, rewardTitle } = req.body;
    const authUser = (req as any).authUser;

    // 校验申请者与 childId 一致，或为 admin
    if (authUser.role !== 'admin' && authUser.id !== childId) {
      return res.status(403).json({ success: false, message: '只能申请自己的兑换' });
    }

    const child = db.prepare('SELECT familyId FROM users WHERE id = ?').get(childId) as any;
    if (!child) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(parentId) as any;
    if (!user || user.familyId !== child.familyId) {
      return res.status(400).json({ success: false, message: '家长与孩子不在同一家庭' });
    }

    // 校验认证用户属于该家庭
    if (authUser.role !== 'admin' && authUser.familyId !== child.familyId) {
      return res.status(403).json({ success: false, message: '无权限操作' });
    }

    const timestamp = Date.now();
    db.prepare('INSERT INTO redemption_records (id, childId, parentId, rewardId, rewardTitle, timestamp, status, familyId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, childId, parentId, rewardId, rewardTitle, timestamp, 'pending', user?.familyId);
    
    // 同时为家长保存持久化通知（兑换申请）
    const notifId = Math.random().toString(36).substr(2, 9);
    db.prepare('INSERT INTO notifications (id, userId, title, message, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
      .run(notifId, parentId, '新的兑换申请', `孩子想要兑换奖励: ${rewardTitle}`, 'info', timestamp);

    res.json({ success: true });
  });

  app.get('/api/redemptions/:uid', authMiddleware, (req, res) => {
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(req.params.uid) as any;
    if (!user) return res.json([]);
    const records = db.prepare('SELECT * FROM redemption_records WHERE familyId = ? OR parentId = ? ORDER BY timestamp DESC').all(user.familyId, req.params.uid);
    res.json(records);
  });

  app.get('/api/redemptions/child/:childId', authMiddleware, (req, res) => {
    const authUser = (req as any).authUser;
    const child = db.prepare('SELECT familyId FROM users WHERE id = ?').get(req.params.childId) as any;
    if (!child || (authUser.role !== 'admin' && child.familyId !== authUser.familyId)) {
      return res.status(403).json({ success: false, message: '无权限查看该兑换记录' });
    }
    const records = db.prepare('SELECT * FROM redemption_records WHERE childId = ? ORDER BY timestamp DESC').all(req.params.childId);
    res.json(records);
  });

  app.post('/api/redemptions/approve', authMiddleware, (req, res) => {
    const { id, childId, rewardId, rewardTitle } = req.body;
    const authUser = (req as any).authUser;
    const child = db.prepare('SELECT familyId FROM users WHERE id = ?').get(childId) as any;
    if (!child || child.familyId !== authUser.familyId || authUser.role === 'child') {
      return res.status(403).json({ success: false, message: '无权限审批兑换' });
    }

    // 从数据库获取奖励的真实积分成本，不信任客户端传入的值
    const reward = db.prepare('SELECT pointsRequired, title FROM rewards WHERE id = ?').get(rewardId) as any;
    if (!reward) {
      return res.status(404).json({ success: false, message: '奖励不存在' });
    }
    const pointsCost = reward.pointsRequired;
    if (child.points < pointsCost) {
      return res.status(400).json({ success: false, message: '孩子星币余额不足' });
    }
    const historyId = Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();

    try {
      const trx = db.transaction(() => {
        db.prepare("UPDATE redemption_records SET status = 'approved' WHERE id = ?").run(id);
        db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(pointsCost, childId);
        db.prepare('INSERT INTO point_history (id, childId, amount, reason, timestamp, type) VALUES (?, ?, ?, ?, ?, ?)')
          .run(historyId, childId, pointsCost, `兑换奖励: ${rewardTitle || reward.title || '未知奖励'}`, timestamp, 'spend');

        const notifId = Math.random().toString(36).substr(2, 9);
        db.prepare('INSERT INTO notifications (id, userId, title, message, type, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(notifId, childId, '心愿达成！', `太棒了！爸爸妈妈批准了你的兑换申请："${rewardTitle || reward.title}"。快去抱抱他们吧！`, 'wish_granted', timestamp, JSON.stringify({ rewardId, rewardTitle: rewardTitle || reward.title }));
      });
      trx();

      logAction({
        level: 'INFO',
        action: 'REDEMPTION_APPROVED',
        userId: childId,
        details: `Approved redemption: ${rewardTitle || reward.title} (${pointsCost} pts) for ${childId}`,
        success: true
      });

      res.json({ success: true });
    } catch (e) {
      logAction({
        level: 'ERROR',
        action: 'REDEMPTION_APPROVED',
        details: `Failed to approve redemption ${id}: ${(e as Error).message}`,
        success: false
      });
      res.status(500).json({ success: false, error: '操作失败，请稍后重试' });
    }
  });

  app.post('/api/redemptions/reject', authMiddleware, (req, res) => {
    const { id, childId, rewardTitle, rejectionReason } = req.body;
    const authUser = (req as any).authUser;
    const child = db.prepare('SELECT familyId FROM users WHERE id = ?').get(childId) as any;
    if (!child || child.familyId !== authUser.familyId || authUser.role === 'child') {
      return res.status(403).json({ success: false, message: '无权限拒绝兑换' });
    }
    const timestamp = Date.now();
    try {
      db.prepare("UPDATE redemption_records SET status = 'rejected', rejectionReason = ? WHERE id = ?").run(rejectionReason, id);
      
      const notifId = Math.random().toString(36).substr(2, 9);
      db.prepare('INSERT INTO notifications (id, userId, title, message, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
        .run(notifId, childId, '心愿申请需要调整', `关于兑换"${rewardTitle}"，爸爸妈妈有话对你说：${rejectionReason}`, 'error', timestamp);

      logAction({
        level: 'INFO',
        action: 'REDEMPTION_REJECTED',
        userId: childId,
        details: `Rejected redemption: ${rewardTitle} for ${childId}. Reason: ${rejectionReason}`,
        success: true
      });

      res.json({ success: true });
    } catch (e) {
      logAction({
        level: 'ERROR',
        action: 'REDEMPTION_REJECTED',
        details: `Failed to reject redemption ${id}: ${(e as Error).message}`,
        success: false
      });
      res.status(500).json({ success: false, error: '操作失败，请稍后重试' });
    }
  });

  app.get('/api/stats/:childId', authMiddleware, (req, res) => {
    const authUser = (req as any).authUser;
    const child = db.prepare('SELECT familyId FROM users WHERE id = ?').get(req.params.childId) as any;
    if (!child || (authUser.role !== 'admin' && child.familyId !== authUser.familyId)) {
      return res.status(403).json({ success: false, message: '无权限查看该数据' });
    }
    const stats = db.prepare(`
      SELECT date(timestamp/1000, 'unixepoch') as date, SUM(amount) as total 
      FROM point_history 
      WHERE childId = ? AND type = 'earn'
      GROUP BY date 
      ORDER BY date ASC 
      LIMIT 30
    `).all(req.params.childId);
    res.json(stats);
  });

  app.get('/api/growth-history/:parentId', authMiddleware, (req, res) => {
    const authUser = (req as any).authUser;
    const parentId = req.params.parentId;
    const { childId, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(parentId) as any;
    if (!user || (authUser.role !== 'admin' && user.familyId !== authUser.familyId)) {
      return res.status(403).json({ success: false, message: '无权限查看该成长历史' });
    }

    let taskQuery = "SELECT 'task' as type, id, childId, title, points, status, timestamp FROM task_submissions WHERE familyId = ? AND status IN ('approved', 'rejected')";
    let redemptionQuery = "SELECT 'redemption' as type, id, childId, rewardTitle as title, 0 as points, status, timestamp FROM redemption_records WHERE familyId = ? AND status IN ('approved', 'rejected')";
    const params: any[] = [user.familyId, user.familyId];

    if (childId && childId !== 'all') {
      taskQuery += " AND childId = ?";
      redemptionQuery += " AND childId = ?";
      params.push(childId, childId);
    }

    const combinedQuery = `
      SELECT * FROM (${taskQuery} UNION ALL ${redemptionQuery})
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;

    const totalQuery = `
      SELECT COUNT(*) as count FROM (${taskQuery} UNION ALL ${redemptionQuery})
    `;

    try {
      const items = db.prepare(combinedQuery).all(...params, limit, offset);
      const total = (db.prepare(totalQuery).get(...params) as any).count;
      res.json({ total, items });
    } catch (e) {
      res.status(500).json({ error: '操作失败，请稍后重试' });
    }
  });

  app.delete('/api/tasks/:id', authMiddleware, (req, res) => {
    const authUser = (req as any).authUser;
    const task = db.prepare('SELECT * FROM task_submissions WHERE id = ?').get(req.params.id) as any;
    if (!task || task.familyId !== authUser.familyId) {
      return res.status(403).json({ success: false, message: '无权限删除该任务' });
    }
    try {
      db.prepare('DELETE FROM task_submissions WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '操作失败，请稍后重试' });
    }
  });

  app.delete('/api/redemptions/:id', authMiddleware, (req, res) => {
    const authUser = (req as any).authUser;
    const record = db.prepare('SELECT * FROM redemption_records WHERE id = ?').get(req.params.id) as any;
    if (!record || record.familyId !== authUser.familyId) {
      return res.status(403).json({ success: false, message: '无权限删除该兑换记录' });
    }
    try {
      db.prepare('DELETE FROM redemption_records WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '操作失败，请稍后重试' });
    }
  });

  // 未匹配的API路由兜底处理
  app.all('/api/*', (req, res) => {
    console.warn(`[API 404] ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.url}` });
  });

  // Vite中间件
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
