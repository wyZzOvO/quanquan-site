#!/usr/bin/env bash
# 回滚官网静态产物到上一个版本（需求文档 20.3：15 分钟内恢复）。只切换软链接，nginx 不用重载。
#   ./deploy/rollback.sh              # 切回上一个版本
#   ./deploy/rollback.sh <版本目录名>  # 切到指定版本（releases/ 下的目录名）
# 如果是 nginx 接管根地址出了问题，见 deploy/README.md「回滚」还原站点配置。
set -euo pipefail

HOST="${DEPLOY_HOST:-ubuntu@62.234.35.78}"
SITE_ROOT="${DEPLOY_SITE_ROOT:-/var/www/quanquan-site}"
TARGET="${1:-}"
SSH_OPTS=(-o ConnectTimeout=10 -o BatchMode=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=4)

ssh "${SSH_OPTS[@]}" "$HOST" "set -e
cd '$SITE_ROOT'
CUR=\$(readlink current)
if [ -n '$TARGET' ]; then
  NEXT='releases/$TARGET'
else
  NEXT=\$(ls -1dt releases/* | grep -vx \"\$CUR\" | head -n 1)
fi
test -n \"\$NEXT\" && test -f \"\$NEXT/index.html\" || { echo '没有可回滚的版本' >&2; exit 1; }
ln -sfn \"\$NEXT\" current.new
mv -T current.new current
printf '%s\trollback\t%s\tfrom=%s\n' \"\$(date '+%F %T')\" \"\$NEXT\" \"\$CUR\" >> releases.log
echo \"current: \$CUR -> \$NEXT\""
