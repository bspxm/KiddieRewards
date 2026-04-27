import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  const secretPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', '.jwt_secret');
  try {
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, 'utf-8').trim();
    }
  } catch { /* ignore */ }
  const secret = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(path.dirname(secretPath), { recursive: true });
    fs.writeFileSync(secretPath, secret, { mode: 0o600 });
  } catch { /* ignore — fallback to volatile */ }
  return secret;
})();
if (!process.env.JWT_SECRET) {
  console.warn('[SECURITY NOTICE] JWT_SECRET loaded from data/.jwt_secret (auto-persisted across restarts). Set JWT_SECRET in .env for production.');
}
const JWT_EXPIRES_IN = '24h';
const BCRYPT_ROUNDS = 10;

// MED-05: JWT 仅存 session_id，用户信息通过 session_id 查库获取（减少信息暴露）
const sessionStore = new Map<string, { id: string; name: string; role: string; familyId?: string; parentId?: string; createdAt: number }>();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24h

function cleanupSessions() {
  const now = Date.now();
  for (const [sid, sess] of sessionStore) {
    if (now - sess.createdAt > SESSION_TTL) {
      sessionStore.delete(sid);
    }
  }
}
// 每 30 分钟清理过期 session
setInterval(cleanupSessions, 30 * 60 * 1000);

export function signToken(payload: { id: string; name: string; role: string; familyId?: string; parentId?: string }): string {
  const sessionId = crypto.randomBytes(16).toString('hex');
  sessionStore.set(sessionId, { ...payload, createdAt: Date.now() });
  return jwt.sign({ sid: sessionId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, noTimestamp: false });
}

export function verifyToken(token: string): jwt.JwtPayload & { id: string; name: string; role: string; familyId?: string; parentId?: string } {
  const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

  // 新式：通过 session_id 查找
  if (decoded.sid) {
    const sess = sessionStore.get(decoded.sid);
    if (!sess || Date.now() - sess.createdAt > SESSION_TTL) {
      throw new Error('Session expired');
    }
    return { ...sess, iat: decoded.iat, exp: decoded.exp };
  }

  // 兼容旧式：token 中直接包含用户信息
  if (decoded.id && decoded.name && decoded.role) {
    return decoded as jwt.JwtPayload & { id: string; name: string; role: string; familyId?: string; parentId?: string };
  }

  throw new Error('Invalid token');
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function upgradePasswordToHash(password: string, db: any) {
  const hash = await hashPassword(password);
  return hash;
}
