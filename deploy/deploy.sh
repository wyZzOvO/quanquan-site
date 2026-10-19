#!/usr/bin/env bash
# 构建并发布官网（需求文档 20.2）：在开发机的 quanquan-site 目录执行。
#   ./deploy/deploy.sh
# 单测 → 正式构建（含产物检查与正式发布检查：备案号、联系渠道、素材审核……任何一项不过就中止）
# → 打包上传到 /var/www/quanquan-site/releases/<版本> → 把上一版带哈希的资源补进新版本（已打开的旧页面按需加载不会 404）
# → 原子切换软链接 current → 只保留最近 DEPLOY_KEEP 个版本 → 记录发布日志 → 冒烟检查。
# 静态文件，nginx 不用重载；首次接管根地址另外执行 ./deploy/install-nginx.sh。
# 可用环境变量覆盖：DEPLOY_HOST（默认 ubuntu@62.234.35.78）、DEPLOY_SITE_ROOT（默认 /var/www/quanquan-site）、
#   DEPLOY_KEEP（默认 5）、SITE_URL（默认 https://www.monster-ovo.cn）
# 回滚：./deploy/rollback.sh
set -euo pipefail

HOST="${DEPLOY_HOST:-ubuntu@62.234.35.78}"
SITE_ROOT="${DEPLOY_SITE_ROOT:-/var/www/quanquan-site}"
KEEP="${DEPLOY_KEEP:-5}"
SSH_OPTS=(-o ConnectTimeout=10 -o BatchMode=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=4)

cd "$(dirname "$0")/.."

retry() {
  local n=0 code
  while true; do
    code=0
    "$@" || code=$?
    if [ "$code" -ne 255 ] && ! { [ "$1" = scp ] && [ "$code" -ne 0 ]; }; then
      return "$code"
    fi
    n=$((n + 1))
    if [ "$n" -ge 5 ]; then
      echo "连接失败，重试 5 次仍不行：$*" >&2
      return "$code"
    fi
    echo "连接失败，3 秒后重试（第 $n 次）…" >&2
    sleep 3
  done
}

npm test
npm run build:production

SHA="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
DIRTY=""
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  DIRTY="+dirty"
fi
VERSION="$(date +%Y%m%d-%H%M%S)-${SHA}${DIRTY}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
COPYFILE_DISABLE=1 tar --no-xattrs -C dist -czf "$TMP/site.tgz" .
echo "发布 $VERSION 到 $HOST:$SITE_ROOT"

retry ssh "${SSH_OPTS[@]}" "$HOST" "mkdir -p '$SITE_ROOT/releases' && test -w '$SITE_ROOT/releases'" || {
  echo "服务器上的 $SITE_ROOT 不可写：首次请执行 ssh $HOST 'sudo mkdir -p $SITE_ROOT && sudo chown \$(id -un):\$(id -gn) $SITE_ROOT'" >&2
  exit 1
}
retry scp "${SSH_OPTS[@]}" "$TMP/site.tgz" "$HOST:/tmp/quanquan-site.tgz"
retry ssh "${SSH_OPTS[@]}" "$HOST" "set -e
cd '$SITE_ROOT'
REL='releases/$VERSION'
mkdir -p \"\$REL\"
tar -xzf /tmp/quanquan-site.tgz -C \"\$REL\"
rm -f /tmp/quanquan-site.tgz
test -f \"\$REL/index.html\" && test -f \"\$REL/404.html\"
if [ -d current/_site ]; then cp -rn current/_site/. \"\$REL/_site/\" 2>/dev/null || true; fi
PREV=\$(readlink current 2>/dev/null || echo '')
ln -sfn \"\$REL\" current.new
mv -T current.new current
printf '%s\t%s\t%s\tprev=%s\n' \"\$(date '+%F %T')\" '$VERSION' \"\$(id -un)\" \"\$PREV\" >> releases.log
ls -1dt releases/* | tail -n +$((KEEP + 1)) | while read -r old; do [ \"\$old\" != \"\$REL\" ] && rm -rf \"\$old\"; done
echo \"current -> \$(readlink current)\""

echo "发布完成。冒烟检查："
./deploy/smoke.sh || {
  echo "冒烟检查没有通过。如需回滚：./deploy/rollback.sh" >&2
  exit 1
}
