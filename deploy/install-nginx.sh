#!/usr/bin/env bash
# 首次让官网接管根地址（需求文档 13.3）：在开发机的 quanquan-site 目录执行，服务器账号要有免密 sudo。
#   ./deploy/install-nginx.sh
#
# 前提：已经用 ./deploy/deploy.sh 发布过一次（/var/www/quanquan-site/current/index.html 存在），否则中止。
# 做的事：
#   1. 第一次执行时备份站点配置和网页版片段（*.bak-before-site）
#   2. 装上 /etc/nginx/snippets/quanquan-site.conf 与 quanquan-site-headers.conf
#   3. 去掉网页版片段里"根地址 302 到 /web/"的那一段（根地址改由官网提供；/web/ 本身不变）
#   4. 在 443 server 里网页版 include 的下一行加上官网的 include
#   5. nginx -t 通过才重载；没通过就把站点配置和网页版片段都还原
# 可以重复执行。撤销见 deploy/README.md「回滚」。
# 可用环境变量覆盖：DEPLOY_HOST（默认 ubuntu@62.234.35.78）、SITE_CONF（默认 /etc/nginx/conf.d/www.monster-ovo.cn.conf）
set -euo pipefail

HOST="${DEPLOY_HOST:-ubuntu@62.234.35.78}"
SITE_CONF="${SITE_CONF:-/etc/nginx/conf.d/www.monster-ovo.cn.conf}"
SSH_OPTS=(-o ConnectTimeout=10 -o BatchMode=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=4)

cd "$(dirname "$0")/.."

# 服务器 sshd 偶尔在握手前断开连接：只在连接失败（255）或 scp 失败时重试
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

REMOTE_SCRIPT=$(cat <<REMOTE
set -euo pipefail
SITE="$SITE_CONF"
REMOTE
)
REMOTE_SCRIPT+=$(cat <<'REMOTE'

SITE_BACKUP="/etc/nginx/$(basename "$SITE").bak-before-site"
WEB_SNIPPET=/etc/nginx/snippets/quanquan-web.conf
WEB_BACKUP=/etc/nginx/quanquan-web.conf.bak-before-site
SNIPPET=/etc/nginx/snippets/quanquan-site.conf
HEADERS=/etc/nginx/snippets/quanquan-site-headers.conf
WEB_INCLUDE='include snippets/quanquan-web.conf;'
SITE_INCLUDE='include snippets/quanquan-site.conf;'

sudo -n true 2>/dev/null || { echo "服务器账号没有免密 sudo，无法修改 nginx" >&2; exit 1; }
test -f "$SITE" || { echo "没有找到站点配置 $SITE" >&2; exit 1; }
test -f /var/www/quanquan-site/current/index.html || { echo "还没有发布过官网（/var/www/quanquan-site/current/index.html 不存在），先执行 ./deploy/deploy.sh" >&2; exit 1; }

if ! sudo test -f "$SITE_BACKUP"; then
  sudo cp -p "$SITE" "$SITE_BACKUP"
  echo "已备份站点配置：$SITE_BACKUP"
fi
if [ -f "$WEB_SNIPPET" ] && ! sudo test -f "$WEB_BACKUP"; then
  sudo cp -p "$WEB_SNIPPET" "$WEB_BACKUP"
  echo "已备份网页版片段：$WEB_BACKUP"
fi

restore() {
  sudo cp -p "$SITE_BACKUP" "$SITE"
  if sudo test -f "$WEB_BACKUP"; then sudo cp -p "$WEB_BACKUP" "$WEB_SNIPPET"; fi
}

sudo install -m 644 /tmp/quanquan-site.nginx.conf "$SNIPPET"
sudo install -m 644 /tmp/quanquan-site-headers.nginx.conf "$HEADERS"
rm -f /tmp/quanquan-site.nginx.conf /tmp/quanquan-site-headers.nginx.conf

# 根地址改由官网提供：去掉网页版片段里的根地址跳转（带标记的新写法和不带标记的旧写法都处理）
if [ -f "$WEB_SNIPPET" ]; then
  sudo perl -0pi -e 's/# >>> root-redirect.*?# <<< root-redirect\n?//s; s/location = \/ \{\s*return 302 \/web\/;\s*\}\n?//s' "$WEB_SNIPPET"
fi

if ! grep -qF "$SITE_INCLUDE" "$SITE"; then
  if grep -qF "$WEB_INCLUDE" "$SITE"; then
    sudo sed -i "s|^\( *\)$WEB_INCLUDE|&\n\1$SITE_INCLUDE|" "$SITE"
  else
    sudo sed -i "s|^    client_max_body_size 50m;|&\n    $SITE_INCLUDE|" "$SITE"
  fi
fi
if ! grep -qF "$SITE_INCLUDE" "$SITE"; then
  restore
  echo "站点配置里没找到插入位置，请手工在 listen 443 的 server 里加一行：$SITE_INCLUDE" >&2
  exit 1
fi

if sudo nginx -t; then
  sudo systemctl reload nginx
  echo "nginx 已重载：根地址与官网页面由 /var/www/quanquan-site/current 提供，/web/、/api/ 等保持不变"
else
  restore
  sudo nginx -t >/dev/null 2>&1 && sudo systemctl reload nginx || true
  echo "nginx -t 没通过，已还原站点配置和网页版片段" >&2
  exit 1
fi
REMOTE
)

retry scp "${SSH_OPTS[@]}" deploy/nginx/quanquan-site.conf "$HOST:/tmp/quanquan-site.nginx.conf"
retry scp "${SSH_OPTS[@]}" deploy/nginx/quanquan-site-headers.conf "$HOST:/tmp/quanquan-site-headers.nginx.conf"
retry ssh "${SSH_OPTS[@]}" "$HOST" "$REMOTE_SCRIPT"
echo "完成。下一步：./deploy/smoke.sh 检查官网与业务路由"
