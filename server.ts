import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { logAction, getLogs } from './server/logger.js';

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
      // 冷却期已过，重置
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

// 确保所有现有用户在缺失密码时都有默认密码
db.prepare("UPDATE users SET password = '123456' WHERE password IS NULL OR password = ''").run();

async function startServer() {
  const app = express();

  // --- 数据库初始化已移至startServer内部 ---
  try {
    const initTransaction = db.transaction(() => {
      // 初始化管理员（如果不存在）
      const existingAdmin = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
      if (!existingAdmin) {
        db.prepare('INSERT INTO users (id, name, role, points, password) VALUES (?, ?, ?, ?, ?)').run('admin-sys-001', 'admin', 'admin', 0, 'admin123');
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
        db.prepare('INSERT OR REPLACE INTO users (id, name, role, points, password, familyId) VALUES (?, ?, ?, ?, ?, ?)').run(pId, '乐爸/乐妈', 'parent', 0, '123456', famId);
        db.prepare('INSERT OR REPLACE INTO users (id, name, role, parentId, points, password, familyId) VALUES (?, ?, ?, ?, ?, ?, ?)').run('demo-c-001', '小乐', 'child', pId, 100, '123456', famId);
        
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
  // --- 初始化结束 ---

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // 信任代理，在Docker/反向代理后获取真实IP
  app.set('trust proxy', true);

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

  // 健康检查
  app.get('/api/health', (req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ok' });
    } catch (e) {
      res.status(500).json({ status: 'error' });
    }
  });

  // 调试用接口，用于检查用户
  app.get('/api/debug/users', (req, res) => {
    try {
      const users = db.prepare('SELECT id, name, role, password FROM users').all();
      res.json(users);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // 通用登录接口，支持User@Family格式
  app.post('/api/login', (req, res) => {
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
      if (admin && admin.password === password) {
        recordSuccess(clientKey);
        logAction({
          level: 'INFO',
          action: 'LOGIN_SUCCESS',
          userId: admin.id,
          userName: admin.name,
          details: 'Super Admin login success',
          success: true,
          ip
        });
        return res.json({ success: true, user: { id: admin.id, name: admin.name, role: admin.role } });
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
      return res.status(401).json({ success: false, message: '管理员密码错误' });
    }

    // 2. User@Family检查
    if (!name.includes('@')) {
      return res.status(400).json({ success: false, message: '请输入格式如 名称@家庭 的账号' });
    }

    const [username, familyName] = name.split('@');
    
    // 查找家庭
    const family = db.prepare("SELECT id FROM families WHERE LOWER(name) = LOWER(?)").get(familyName) as any;
    if (!family) {
      logAction({
        level: 'WARN',
        action: 'LOGIN_FAILED',
        userName: name,
        details: `Family not found: ${familyName}`,
        success: false,
        ip
      });
      return res.status(404).json({ success: false, message: `找不到家庭: ${familyName}` });
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
      return res.status(401).json({ success: false, message: '用户名不存在' });
    }

    if (user.password !== password) {
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
      return res.status(401).json({ success: false, message: '密码错误' });
    }

    recordSuccess(clientKey);
    try {
      db.prepare('UPDATE families SET lastActiveAt = ? WHERE id = ?').run(Date.now(), family.id);
    } catch(e) {}

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
    res.json({ success: true, user: { id: user.id, name: user.name, role: user.role, parentId: user.parentId, familyId: user.familyId } });
  });

  // Admin: 获取所有家庭及其成员
  app.post('/api/admin/change-password', (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const admin = db.prepare("SELECT * FROM users WHERE role = 'admin' AND name = 'admin'").get() as any;
    
    if (!admin || admin.password !== currentPassword) {
      return res.status(401).json({ success: false, error: '当前密码错误' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: '新密码至少6位' });
    }

    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword, admin.id);
    
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

  app.get('/api/admin/families', (req, res) => {
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
  app.delete('/api/admin/families/:id', (req, res) => {
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
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  // Admin日志API
  app.get('/api/admin/logs', (req, res) => {
    const { year, month } = req.query;
    try {
      const logs = getLogs(year as string, month as string);
      res.json(logs.slice(0, 500)); // Limit to first 500 logs for UI performance
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post('/api/users/update-password', (req, res) => {
    const { userId, newPassword } = req.body;
    try {
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword, userId);
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, message: '更新密码失败' });
    }
  });

  // API路由
  app.get('/api/notifications/:userId', (req, res) => {
    const notifications = db.prepare('SELECT * FROM notifications WHERE userId = ? ORDER BY timestamp DESC LIMIT 20').all(req.params.userId);
    res.json(notifications);
  });

  app.post('/api/notifications/read', (req, res) => {
    const { userId } = req.body;
    db.prepare('UPDATE notifications SET isRead = 1 WHERE userId = ?').run(userId);
    res.json({ success: true });
  });

  app.post('/api/login/parent', (req, res) => {
    const { userId, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'parent'").get(userId) as any;
    
    if (user) {
      // 健壮检查密码
      const isValid = user.password === password || (user.password === null && password === '123456') || (user.password === '' && password === '123456');
      if (isValid) {
        res.json({ success: true });
      } else {
        res.status(401).json({ success: false, message: '密码错误' });
      }
    } else {
      res.status(404).json({ success: false, message: '无法找到该家长账号' });
    }
  });

  app.get('/api/users', (req, res) => {
    const users = db.prepare('SELECT * FROM users').all();
    res.json(users);
  });

  app.post('/api/register/family', (req, res) => {
    const { familyName, adminName, password } = req.body;
    const famId = 'fam_' + Math.random().toString(36).substr(2, 9);
    const pId = 'p_' + Math.random().toString(36).substr(2, 9);
    
    try {
      const trx = db.transaction(() => {
        db.prepare('INSERT INTO families (id, name, createdAt, lastActiveAt) VALUES (?, ?, ?, ?)').run(famId, familyName, Date.now(), Date.now());
        db.prepare('INSERT INTO users (id, name, role, points, password, familyId) VALUES (?, ?, ?, ?, ?, ?)').run(pId, adminName, 'parent', 0, password || '123456', famId);
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
      res.status(500).json({ success: false, message: '注册失败，可能家庭名称已存在' });
    }
  });

  app.post('/api/users/add-member', (req, res) => {
    const { name, parentId, password, role } = req.body;
    const parent = db.prepare('SELECT familyId FROM users WHERE id = ?').get(parentId) as any;
    const id = (role === 'parent' ? 'p_' : 'c_') + Math.random().toString(36).substr(2, 9);
    try {
      db.prepare('INSERT INTO users (id, name, role, parentId, points, familyId, password) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, name, role || 'child', parentId, 0, parent.familyId, password || '123456');
      
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

  app.post('/api/users/update-profile', (req, res) => {
    const { userId, name, password } = req.body;
    try {
      if (password) {
        db.prepare('UPDATE users SET name = ?, password = ? WHERE id = ?').run(name, password, userId);
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
  app.delete('/api/users/:id', (req, res) => {
    const userId = req.params.id;
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
      res.status(500).json({ success: false, message: '删除成员失败: ' + (e instanceof Error ? e.message : '未知错误') });
    }
  });

  // 保留旧接口以兼容，直接指向新逻辑
  app.delete('/api/users/child/:id', (req, res) => {
    res.redirect(307, `/api/users/${req.params.id}`);
  });

  app.get('/api/users/:id', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    res.json(user);
  });

  app.get('/api/rules/:uid', (req, res) => {
    const user = db.prepare('SELECT role, familyId FROM users WHERE id = ?').get(req.params.uid) as any;
    if (!user) return res.json([]);
    let rules = db.prepare('SELECT * FROM reward_rules WHERE familyId = ? OR parentId = ?').all(user.familyId, req.params.uid);
    if (user.role === 'child') {
      rules = rules.filter((r: any) => !r.targetChildId || r.targetChildId === 'all' || r.targetChildId === req.params.uid);
    }
    res.json(rules.map((r: any) => ({ ...r, isRepeating: !!r.isRepeating })));
  });

  app.post('/api/rules', (req, res) => {
    const { id, parentId, title, points, icon, description, isRepeating, targetChildId } = req.body;
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(parentId) as any;
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

  app.put('/api/rules/:id', (req, res) => {
    const { title, points, icon, description, isRepeating, targetChildId } = req.body;
    db.prepare('UPDATE reward_rules SET title = ?, points = ?, icon = ?, description = ?, isRepeating = ?, targetChildId = ? WHERE id = ?')
      .run(title, points, icon, description, isRepeating ? 1 : 0, targetChildId || 'all', req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/rules/:id', (req, res) => {
    db.prepare('DELETE FROM reward_rules WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/rules/reactivate', (req, res) => {
    const { ruleId, childId } = req.body;
    try {
      // 归档此孩子在此规则下已批准的提交，以便可以重新提交
      db.prepare("UPDATE task_submissions SET status = 'archived' WHERE ruleId = ? AND childId = ? AND status = 'approved'").run(ruleId, childId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Reactivation failed' });
    }
  });

  app.get('/api/rewards/:uid', (req, res) => {
    const user = db.prepare('SELECT role, familyId FROM users WHERE id = ?').get(req.params.uid) as any;
    if (!user) return res.json([]);
    let rewards = db.prepare('SELECT * FROM rewards WHERE familyId = ? OR parentId = ?').all(user.familyId, req.params.uid);
    if (user.role === 'child') {
      rewards = rewards.filter((r: any) => !r.targetChildId || r.targetChildId === 'all' || r.targetChildId === req.params.uid);
    }
    res.json(rewards);
  });

  app.post('/api/rewards', (req, res) => {
    const { id, parentId, title, pointsRequired, description, targetChildId } = req.body;
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(parentId) as any;
    db.prepare('INSERT INTO rewards (id, parentId, title, pointsRequired, description, familyId, targetChildId) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, parentId, title, pointsRequired, description, user?.familyId, targetChildId || 'all');
    res.status(201).json({ success: true });
  });

  app.put('/api/rewards/:id', (req, res) => {
    const { title, pointsRequired, description, targetChildId } = req.body;
    db.prepare('UPDATE rewards SET title = ?, pointsRequired = ?, description = ?, targetChildId = ? WHERE id = ?')
      .run(title, pointsRequired, description, targetChildId || 'all', req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/rewards/:id', (req, res) => {
    db.prepare('DELETE FROM rewards WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/points/add', (req, res) => {
    const { childId, amount, reason } = req.body;
    const historyId = Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();
    
    const trx = db.transaction(() => {
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(amount, childId);
      db.prepare('INSERT INTO point_history (id, childId, amount, reason, timestamp, type) VALUES (?, ?, ?, ?, ?, ?)')
        .run(historyId, childId, amount, reason, timestamp, 'earn');
    });
    trx();
    
    io.emit('points_updated', { childId, newAmount: amount, reason });
    res.json({ success: true });
  });

  app.get('/api/tasks/rejected/:childId', (req, res) => {
    const tasks = db.prepare("SELECT * FROM task_submissions WHERE childId = ? AND status = 'rejected' ORDER BY timestamp DESC LIMIT 5").all(req.params.childId);
    res.json(tasks);
  });

  app.get('/api/tasks/all/:childId', (req, res) => {
    const tasks = db.prepare('SELECT * FROM task_submissions WHERE childId = ?').all(req.params.childId);
    res.json(tasks);
  });

  app.get('/api/history/:childId', (req, res) => {
    const history = db.prepare('SELECT * FROM point_history WHERE childId = ? ORDER BY timestamp DESC').all(req.params.childId);
    res.json(history);
  });

  app.get('/api/tasks/pending/:uid', (req, res) => {
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(req.params.uid) as any;
    if (!user) return res.json([]);
    const tasks = db.prepare("SELECT * FROM task_submissions WHERE (familyId = ? OR parentId = ?) AND status = 'pending' ORDER BY timestamp DESC").all(user.familyId, req.params.uid);
    res.json(tasks);
  });

  app.post('/api/tasks/submit', (req, res) => {
    const { id, childId, parentId, ruleId, title, points } = req.body;
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(parentId) as any;
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
    io.emit('new_notification', { userId: parentId });

    res.json({ success: true });
  });

  app.post('/api/tasks/approve', (req, res) => {
    const { id, childId, points, title } = req.body;
    const historyId = Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();

    try {
      const trx = db.transaction(() => {
        // 查找与此任务关联的规则ID
        const task = db.prepare('SELECT ruleId FROM task_submissions WHERE id = ?').get(id) as any;
        let isAchievement = false;
        let ruleId = '';
        
        if (task) {
          ruleId = task.ruleId;
          const rule = db.prepare('SELECT isRepeating FROM reward_rules WHERE id = ?').get(task.ruleId) as any;
          if (rule && (rule.isRepeating === 0 || rule.isRepeating === false)) {
            isAchievement = true;
          }
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

      io.emit('new_notification', { userId: childId });
      res.json({ success: true });
    } catch (e) {
      logAction({
        level: 'ERROR',
        action: 'TASK_APPROVED',
        details: `Failed to approve task ${id}: ${(e as Error).message}`,
        success: false
      });
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  app.post('/api/tasks/reject', (req, res) => {
    const { id, childId, title, rejectionReason } = req.body;
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

      io.emit('new_notification', { userId: childId });
      res.json({ success: true });
    } catch (e) {
      logAction({
        level: 'ERROR',
        action: 'TASK_REJECTED',
        details: `Failed to reject task ${id}: ${(e as Error).message}`,
        success: false
      });
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  app.post('/api/redemptions', (req, res) => {
    const { id, childId, parentId, rewardId, rewardTitle } = req.body;
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(parentId) as any;
    const timestamp = Date.now();
    db.prepare('INSERT INTO redemption_records (id, childId, parentId, rewardId, rewardTitle, timestamp, status, familyId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, childId, parentId, rewardId, rewardTitle, timestamp, 'pending', user?.familyId);
    
    // 同时为家长保存持久化通知（兑换申请）
    const notifId = Math.random().toString(36).substr(2, 9);
    db.prepare('INSERT INTO notifications (id, userId, title, message, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
      .run(notifId, parentId, '新的兑换申请', `孩子想要兑换奖励: ${rewardTitle}`, 'info', timestamp);
    io.emit('new_notification', { userId: parentId });

    res.json({ success: true });
  });

  app.get('/api/redemptions/:uid', (req, res) => {
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(req.params.uid) as any;
    if (!user) return res.json([]);
    const records = db.prepare('SELECT * FROM redemption_records WHERE familyId = ? OR parentId = ? ORDER BY timestamp DESC').all(user.familyId, req.params.uid);
    res.json(records);
  });

  app.get('/api/redemptions/child/:childId', (req, res) => {
    const records = db.prepare('SELECT * FROM redemption_records WHERE childId = ? ORDER BY timestamp DESC').all(req.params.childId);
    res.json(records);
  });

  app.post('/api/redemptions/approve', (req, res) => {
    const { id, childId, rewardId, pointsCost, rewardTitle } = req.body;
    const historyId = Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();

    try {
      const trx = db.transaction(() => {
        db.prepare("UPDATE redemption_records SET status = 'approved' WHERE id = ?").run(id);
        db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(pointsCost, childId);
        db.prepare('INSERT INTO point_history (id, childId, amount, reason, timestamp, type) VALUES (?, ?, ?, ?, ?, ?)')
          .run(historyId, childId, pointsCost, `兑换奖励: ${rewardTitle || '未知奖励'}`, timestamp, 'spend');
        
        const notifId = Math.random().toString(36).substr(2, 9);
        db.prepare('INSERT INTO notifications (id, userId, title, message, type, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(notifId, childId, '心愿达成！', `太棒了！爸爸妈妈批准了你的兑换申请："${rewardTitle}"。快去抱抱他们吧！`, 'wish_granted', timestamp, JSON.stringify({ rewardId, rewardTitle }));
      });
      trx();

      logAction({
        level: 'INFO',
        action: 'REDEMPTION_APPROVED',
        userId: childId,
        details: `Approved redemption: ${rewardTitle} (${pointsCost} pts) for ${childId}`,
        success: true
      });

      io.emit('redemption_approved', { childId, rewardId });
      io.emit('new_notification', { userId: childId });
      res.json({ success: true });
    } catch (e) {
      logAction({
        level: 'ERROR',
        action: 'REDEMPTION_APPROVED',
        details: `Failed to approve redemption ${id}: ${(e as Error).message}`,
        success: false
      });
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  app.post('/api/redemptions/reject', (req, res) => {
    const { id, childId, rewardTitle, rejectionReason } = req.body;
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

      io.emit('new_notification', { userId: childId });
      res.json({ success: true });
    } catch (e) {
      logAction({
        level: 'ERROR',
        action: 'REDEMPTION_REJECTED',
        details: `Failed to reject redemption ${id}: ${(e as Error).message}`,
        success: false
      });
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  app.get('/api/stats/:childId', (req, res) => {
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

  app.get('/api/growth-history/:parentId', (req, res) => {
    const parentId = req.params.parentId;
    const { childId, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(parentId) as any;
    if (!user) return res.json({ total: 0, items: [] });

    let taskQuery = "SELECT 'task' as type, id, childId, title, points, status, timestamp FROM task_submissions WHERE familyId = ? AND status IN ('approved', 'rejected')";
    let redemptionQuery = "SELECT 'redemption' as type, id, childId, rewardTitle as title, -points as points, status, timestamp FROM redemption_records WHERE familyId = ? AND status IN ('approved', 'rejected')";
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
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.delete('/api/tasks/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM task_submissions WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: (e as Error).message });
    }
  });

  app.delete('/api/redemptions/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM redemption_records WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: (e as Error).message });
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
