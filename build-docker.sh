#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# KiddieRewards — 构建 Docker 镜像并导出为 tar.gz
# 用法: ./build-docker.sh [版本号]
#   版本号默认为 latest，也可手动指定如 v1.0.0
# ============================================================

VERSION="${1:-latest}"
IMAGE_NAME="kiddierewards"
IMAGE_TAG="${IMAGE_NAME}:${VERSION}"
# 文件名中替换冒号为横杠 (kiddierewards-latest.tar.gz)
ARCHIVE_NAME="${IMAGE_TAG//:/-}.tar.gz"
# 自动从 Dockerfile 提取基础镜像（FROM ... AS builder 行）
BUILDER_BASE=$(grep -m1 'FROM.*AS builder' Dockerfile | awk '{print $2}')

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================================"
echo "  KiddieRewards Docker Build"
echo "  镜像: ${IMAGE_TAG}"
echo "  输出: ${ARCHIVE_NAME}"
echo "======================================================"

# 1. 清理旧的导出文件
if [ -f "$ARCHIVE_NAME" ]; then
  echo "▶ 清理旧的导出文件: ${ARCHIVE_NAME}"
  rm -f "$ARCHIVE_NAME"
fi

# 2. 构建镜像
echo "▶ 构建 Docker 镜像..."
docker build -t "$IMAGE_TAG" .

# 3. 保存为 tar
echo "▶ 导出镜像为 tar..."
docker save -o "${IMAGE_TAG//:/-}.tar" "$IMAGE_TAG"

# 4. 压缩
echo "▶ 压缩为 tar.gz..."
gzip "${IMAGE_TAG//:/-}.tar"

# 5. 清理构建产物
echo "▶ 清理构建产物..."
docker rmi "$IMAGE_TAG" 2>/dev/null || true
[ -n "$BUILDER_BASE" ] && docker rmi "$BUILDER_BASE" 2>/dev/null || true
docker image prune -f 2>/dev/null || true

# 6. 修改文件权限（方便 WSL → Windows 复制）
chmod 666 "$ARCHIVE_NAME"

# 7. 显示结果
echo ""
FILE_SIZE=$(du -sh "$ARCHIVE_NAME" | cut -f1)
echo "✅ 完成！"
echo "   文件: ${SCRIPT_DIR}/${ARCHIVE_NAME}"
echo "   大小: ${FILE_SIZE}"
echo ""
echo "  恢复使用:"
echo "    gunzip -c ${ARCHIVE_NAME} | docker load"
echo "    docker run -d -p 3000:3000 -v /path/to/data:/app/data ${IMAGE_TAG}"
echo ""
