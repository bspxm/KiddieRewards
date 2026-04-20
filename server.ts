import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('kiddie_rewards.db');

// Initialize Database Tables
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
    isRepeating INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS rewards (
    id TEXT PRIMARY KEY,
    familyId TEXT,
    parentId TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    pointsRequired INTEGER NOT NULL,
    image TEXT
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
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS server_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Migrations
try { db.exec("ALTER TABLE reward_rules ADD COLUMN familyId TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE reward_rules ADD COLUMN isRepeating INTEGER DEFAULT 1"); } catch(e) {}
try { db.exec("ALTER TABLE rewards ADD COLUMN familyId TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE redemption_records ADD COLUMN familyId TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE task_submissions ADD COLUMN familyId TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE families ADD COLUMN createdAt INTEGER"); } catch(e) {}
try { db.exec("ALTER TABLE families ADD COLUMN lastActiveAt INTEGER"); } catch(e) {}

// Populate missing defaults
try {
  db.prepare("UPDATE families SET createdAt = ? WHERE createdAt IS NULL").run(Date.now());
  db.prepare("UPDATE families SET lastActiveAt = ? WHERE lastActiveAt IS NULL").run(Date.now());
} catch(e) {}

// Populate missing familyId for existing records
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

// Ensure all existing users have a default password if missing
db.prepare("UPDATE users SET password = '123456' WHERE password IS NULL OR password = ''").run();

async function startServer() {
  const app = express();

  // --- Database Initialization moved inside startServer ---
  try {
    const initTransaction = db.transaction(() => {
      // Force reset Admin
      db.prepare('DELETE FROM users WHERE role = ?').run('admin');
      db.prepare('INSERT OR REPLACE INTO users (id, name, role, points, password) VALUES (?, ?, ?, ?, ?)').run('admin-sys-001', 'admin', 'admin', 0, 'admin123');
      
      const isSeeded = db.prepare('SELECT value FROM server_meta WHERE key = ?').get('seeded');
      if (!isSeeded) {
        // Force reset Demo Family (only on first boot)
        db.prepare('DELETE FROM families WHERE name = ?').run('乐家');
        const famId = 'fam_le';
        db.prepare('INSERT INTO families (id, name, createdAt, lastActiveAt) VALUES (?, ?, ?, ?)').run(famId, '乐家', Date.now(), Date.now());

        db.prepare('DELETE FROM users WHERE name = ? AND familyId = ?').run('乐爸/乐妈', famId);
        db.prepare('DELETE FROM users WHERE name = ? AND familyId = ?').run('小乐', famId);
        
        const pId = 'demo-p-001';
        db.prepare('INSERT OR REPLACE INTO users (id, name, role, points, password, familyId) VALUES (?, ?, ?, ?, ?, ?)').run(pId, '乐爸/乐妈', 'parent', 0, '123456', famId);
        db.prepare('INSERT OR REPLACE INTO users (id, name, role, parentId, points, password, familyId) VALUES (?, ?, ?, ?, ?, ?, ?)').run('demo-c-001', '小乐', 'child', pId, 100, '123456', famId);
        
        // Initial Rules/Rewards
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
  // --- End Initialization ---

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  app.use(express.json());

  // Request logger for debugging
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
  });

  // Debug endpoint to check users
  app.get('/api/debug/users', (req, res) => {
    try {
      const users = db.prepare('SELECT id, name, role, password FROM users').all();
      res.json(users);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Generalized Login supporting User@Family
  app.post('/api/login', (req, res) => {
    const { name, password } = req.body;
    console.log(`[AUTH DEBUG] Login attempt: [${name}]`);
    
    // 1. Super Admin check
    if (name.toLowerCase() === 'admin') {
      const admin = db.prepare("SELECT * FROM users WHERE role = 'admin' AND name = 'admin'").get() as any;
      if (admin && admin.password === password) {
        return res.json({ success: true, user: { id: admin.id, name: admin.name, role: admin.role } });
      }
      return res.status(401).json({ success: false, message: '管理员密码错误' });
    }

    // 2. User@Family check
    if (!name.includes('@')) {
      return res.status(400).json({ success: false, message: '请输入格式如 名称@家庭 的账号' });
    }

    const [username, familyName] = name.split('@');
    
    // Find family
    const family = db.prepare("SELECT id FROM families WHERE LOWER(name) = LOWER(?)").get(familyName) as any;
    if (!family) {
      return res.status(404).json({ success: false, message: `找不到家庭: ${familyName}` });
    }

    // Find user in family
    const user = db.prepare("SELECT * FROM users WHERE LOWER(name) = LOWER(?) AND familyId = ?").get(username, family.id) as any;
    
    if (!user) {
      return res.status(401).json({ success: false, message: '用户名不存在' });
    }

    if (user.password !== password) {
      return res.status(401).json({ success: false, message: '密码错误' });
    }

    try {
      db.prepare('UPDATE families SET lastActiveAt = ? WHERE id = ?').run(Date.now(), family.id);
    } catch(e) {}

    console.log(`[AUTH DEBUG] Login successful: [${name}]`);
    res.json({ success: true, user: { id: user.id, name: user.name, role: user.role, parentId: user.parentId, familyId: user.familyId } });
  });

  // Admin: Get all families with members
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

  // Admin: Delete family
  app.delete('/api/admin/families/:id', (req, res) => {
    const familyId = req.params.id;
    console.log(`[ADMIN] Attempting to delete family: ${familyId}`);
    
    try {
      const trx = db.transaction(() => {
        // 1. Clear tables that have familyId directly
        db.prepare('DELETE FROM reward_rules WHERE familyId = ?').run(familyId);
        db.prepare('DELETE FROM rewards WHERE familyId = ?').run(familyId);
        db.prepare('DELETE FROM task_submissions WHERE familyId = ?').run(familyId);
        db.prepare('DELETE FROM redemption_records WHERE familyId = ?').run(familyId);

        // 2. Get all users in the family to clear legacy/user-bound tables
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
        
        // Ensure legacy reward rules or old task_submissions created before migration get cleaned up just in case
        if (userIds.length > 0) {
          const placeholders = userIds.map(() => '?').join(',');
          try {
            db.prepare(`DELETE FROM reward_rules WHERE parentId IN (${placeholders})`).run(...userIds);
            db.prepare(`DELETE FROM rewards WHERE parentId IN (${placeholders})`).run(...userIds);
            db.prepare(`DELETE FROM task_submissions WHERE childId IN (${placeholders}) OR parentId IN (${placeholders})`).run(...userIds, ...userIds);
            db.prepare(`DELETE FROM redemption_records WHERE childId IN (${placeholders}) OR parentId IN (${placeholders})`).run(...userIds, ...userIds);
          } catch(e) {}
        }

        // 3. Clear users
        db.prepare('DELETE FROM users WHERE familyId = ?').run(familyId);

        // 4. Finally, clear family
        db.prepare('DELETE FROM families WHERE id = ?').run(familyId);
      });
      
      trx();
      console.log(`[ADMIN] Successfully deleted family: ${familyId}`);
      res.json({ success: true });
    } catch (e) {
      console.error(`[ADMIN] Delete Family Error (${familyId}):`, e);
      res.status(500).json({ success: false, error: (e as Error).message });
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

  // API Routes
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
      // Robust check for password
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
      res.json({ success: true, user: { id: pId, name: adminName, role: 'parent', familyId: famId } });
    } catch (e) {
      console.error(e);
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
      res.json({ success: true, user: { id, name, role: role || 'child', parentId, familyId: parent.familyId } });
    } catch (e) {
      console.error(e);
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

  app.delete('/api/users/child/:id', (req, res) => {
    const childId = req.params.id;
    try {
      const trx = db.transaction(() => {
        db.prepare('DELETE FROM redemption_records WHERE childId = ?').run(childId);
        db.prepare('DELETE FROM point_history WHERE childId = ?').run(childId);
        db.prepare('DELETE FROM task_submissions WHERE childId = ?').run(childId);
        db.prepare('DELETE FROM notifications WHERE userId = ?').run(childId);
        db.prepare('DELETE FROM users WHERE id = ?').run(childId);
      });
      trx();
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, message: '删除失败' });
    }
  });

  app.get('/api/users/:id', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    res.json(user);
  });

  app.get('/api/rules/:uid', (req, res) => {
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(req.params.uid) as any;
    if (!user) return res.json([]);
    const rules = db.prepare('SELECT * FROM reward_rules WHERE familyId = ? OR parentId = ?').all(user.familyId, req.params.uid);
    res.json(rules.map((r: any) => ({ ...r, isRepeating: !!r.isRepeating })));
  });

  app.post('/api/rules', (req, res) => {
    const { id, parentId, title, points, icon, description, isRepeating } = req.body;
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(parentId) as any;
    db.prepare('INSERT INTO reward_rules (id, parentId, title, points, icon, description, familyId, isRepeating) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, parentId, title, points, icon, description, user?.familyId, isRepeating ? 1 : 0);
    res.status(201).json({ success: true });
  });

  app.put('/api/rules/:id', (req, res) => {
    const { title, points, icon, description, isRepeating } = req.body;
    db.prepare('UPDATE reward_rules SET title = ?, points = ?, icon = ?, description = ?, isRepeating = ? WHERE id = ?')
      .run(title, points, icon, description, isRepeating ? 1 : 0, req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/rules/:id', (req, res) => {
    db.prepare('DELETE FROM reward_rules WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/rewards/:uid', (req, res) => {
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(req.params.uid) as any;
    if (!user) return res.json([]);
    const rewards = db.prepare('SELECT * FROM rewards WHERE familyId = ? OR parentId = ?').all(user.familyId, req.params.uid);
    res.json(rewards);
  });

  app.post('/api/rewards', (req, res) => {
    const { id, parentId, title, pointsRequired, description } = req.body;
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(parentId) as any;
    db.prepare('INSERT INTO rewards (id, parentId, title, pointsRequired, description, familyId) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, parentId, title, pointsRequired, description, user?.familyId);
    res.status(201).json({ success: true });
  });

  app.put('/api/rewards/:id', (req, res) => {
    const { title, pointsRequired, description } = req.body;
    db.prepare('UPDATE rewards SET title = ?, pointsRequired = ?, description = ? WHERE id = ?')
      .run(title, pointsRequired, description, req.params.id);
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
    db.prepare('INSERT INTO task_submissions (id, childId, parentId, ruleId, title, points, timestamp, status, familyId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, childId, parentId, ruleId, title, points, timestamp, 'pending', user?.familyId);
    
    io.emit('new_task_submission', { childId, title });
    res.json({ success: true });
  });

  app.post('/api/tasks/approve', (req, res) => {
    const { id, childId, points, title } = req.body;
    const historyId = Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();

    const trx = db.transaction(() => {
      db.prepare("UPDATE task_submissions SET status = 'approved' WHERE id = ?").run(id);
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(points, childId);
      db.prepare('INSERT INTO point_history (id, childId, amount, reason, timestamp, type) VALUES (?, ?, ?, ?, ?, ?)')
        .run(historyId, childId, points, title, timestamp, 'earn');
      
      const notifId = Math.random().toString(36).substr(2, 9);
      db.prepare('INSERT INTO notifications (id, userId, title, message, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
        .run(notifId, childId, '任务已通过！', `你的任务"${title}"已获得 ${points} 星币奖励！继续加油哦！`, 'success', timestamp);
    });
    trx();

    io.emit('task_approved', { childId, title, points });
    io.emit('new_notification', { userId: childId });
    res.json({ success: true });
  });

  app.post('/api/tasks/reject', (req, res) => {
    const { id, childId, title, rejectionReason } = req.body;
    const timestamp = Date.now();
    db.prepare("UPDATE task_submissions SET status = 'rejected', rejectionReason = ? WHERE id = ?").run(rejectionReason, id);
    
    const notifId = Math.random().toString(36).substr(2, 9);
    db.prepare('INSERT INTO notifications (id, userId, title, message, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
      .run(notifId, childId, '任务需要调整', `任务"${title}"暂时没通过。爸爸妈妈说：${rejectionReason}`, 'error', timestamp);

    io.emit('task_rejected', { childId, title, rejectionReason });
    io.emit('new_notification', { userId: childId });
    res.json({ success: true });
  });

  app.post('/api/redemptions', (req, res) => {
    const { id, childId, parentId, rewardId, rewardTitle } = req.body;
    const user = db.prepare('SELECT familyId FROM users WHERE id = ?').get(parentId) as any;
    const timestamp = Date.now();
    db.prepare('INSERT INTO redemption_records (id, childId, parentId, rewardId, rewardTitle, timestamp, status, familyId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, childId, parentId, rewardId, rewardTitle, timestamp, 'pending', user?.familyId);
    
    io.emit('new_redemption', { childId, rewardTitle });
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

    const trx = db.transaction(() => {
      db.prepare("UPDATE redemption_records SET status = 'approved' WHERE id = ?").run(id);
      db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(pointsCost, childId);
      db.prepare('INSERT INTO point_history (id, childId, amount, reason, timestamp, type) VALUES (?, ?, ?, ?, ?, ?)')
        .run(historyId, childId, pointsCost, `兑换奖励: ${rewardTitle || '未知奖励'}`, timestamp, 'spend');
    });
    trx();

    io.emit('redemption_approved', { childId, rewardId });
    res.json({ success: true });
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

  // Catch-all for unmatched API routes
  app.all('/api/*', (req, res) => {
    console.warn(`[API 404] ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.url}` });
  });

  // Vite Middleware
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
