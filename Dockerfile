# ========= 构建阶段 =========
FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/node:22-slim AS builder

WORKDIR /app

# 国内 npm 源
RUN npm config set registry https://registry.npmmirror.com

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# 1. 构建前端
RUN npm run build

# 2. 编译服务端代码
# 将 server.js 放在根目录，避免静态路径冲突
RUN npx esbuild server.ts --bundle --platform=node --format=esm --target=node22 --outfile=server.js --external:express --external:vite --external:better-sqlite3 --external:socket.io

# 3. 剔除开发依赖
RUN npm prune --production


# ========= 运行阶段 =========
FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/node:22-slim

WORKDIR /app

ENV NODE_ENV=production

# 复制必要文件
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js

# 创建数据和日志目录并设置权限
RUN mkdir -p /app/data /app/logs && chown -R node:node /app

# 使用非特权用户
USER node

# 挂载卷
VOLUME ["/app/data", "/app/logs"]

EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null http://localhost:3000/api/health || exit 1

# 运行编译后的代码
CMD ["node", "server.js"]
