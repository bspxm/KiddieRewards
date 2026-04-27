import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const LOGS_ROOT = path.join(process.cwd(), 'logs');

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';
  action: string;
  userId?: string;
  userName?: string;
  familyId?: string;
  ip?: string;
  details: string;
  success: boolean;
}

export function logAction(entry: Omit<LogEntry, 'timestamp'>) {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const date = now.getDate().toString().padStart(2, '0');
  
  const dirPath = path.join(LOGS_ROOT, year, month);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  const filePath = path.join(dirPath, 'actions.log');
  const logEntry: LogEntry = {
    ...entry,
    timestamp: now.toISOString(),
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  fs.appendFileSync(filePath, logLine);
  
  // 同时输出到控制台以便查看
  const color = entry.level === 'ERROR' ? '\x1b[31m' : entry.level === 'WARN' ? '\x1b[33m' : entry.level === 'SECURITY' ? '\x1b[35m' : '\x1b[32m';
  const reset = '\x1b[0m';
  console.log(`${color}[${entry.level}]${reset} ${entry.action} - ${entry.details} (${entry.success ? 'Success' : 'Failed'})`);
}

export function getLogs(year?: string, month?: string) {
  const results: LogEntry[] = [];
  
  const targetDir = year && month ? path.join(LOGS_ROOT, year, month) : LOGS_ROOT;
  
  if (!fs.existsSync(targetDir)) return [];

  const walk = (dir: string) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (file === 'actions.log') {
        const content = fs.readFileSync(fullPath, 'utf8');
        content.split('\n').filter(Boolean).forEach(line => {
          try {
            results.push(JSON.parse(line));
          } catch (e) {}
        });
      }
    }
  };

  walk(targetDir);
  return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
