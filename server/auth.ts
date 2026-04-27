import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('[SECURITY WARNING] JWT_SECRET not set! Using auto-generated secret. Tokens will invalidate on restart. Set JWT_SECRET in .env for production.');
}
const JWT_EXPIRES_IN = '24h';
const BCRYPT_ROUNDS = 10;

export function signToken(payload: { id: string; name: string; role: string; familyId?: string; parentId?: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): jwt.JwtPayload & { id: string; name: string; role: string; familyId?: string; parentId?: string } {
  return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & { id: string; name: string; role: string; familyId?: string; parentId?: string };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  // 兼容旧版明文密码：如果hash不是bcrypt格式（$2a$/$2b$开头），则直接比对
  if (!hash.startsWith('$2')) {
    return password === hash;
  }
  return bcrypt.compare(password, hash);
}

export async function upgradePasswordToHash(password: string, db: any) {
  const hash = await hashPassword(password);
  return hash;
}
