#!/usr/bin/env bash
# 线上冒烟检查（需求文档 AC08、AC10、AC12、20.2）：官网页面与状态码、安全响应头，以及官网接管根地址后
# 业务路由没有被吞掉（/web/、/api/、/legal/、/s/、/.well-known/、/im）。发布后、改 nginx 后都执行一次。
#   ./deploy/smoke.sh                       # 默认 https://www.monster-ovo.cn
#   SITE_URL=https://example.cn ./deploy/smoke.sh
set -uo pipefail

BASE="${SITE_URL:-https://www.monster-ovo.cn}"
FAIL=0

status() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@"; }
header() { curl -s -D - -o /dev/null --max-time 15 "$1" | tr -d '\r' | grep -i "^$2:" | head -1; }
body() { curl -s --max-time 15 "$1"; }

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✓ $name（$actual）"
  else
    echo "  ✗ $name：期望 $expected，实际 $actual"
    FAIL=1
  fi
}

contains() {
  local name="$1" haystack="$2" needle="$3"
  if printf '%s' "$haystack" | grep -qF -- "$needle"; then
    echo "  ✓ $name"
  else
    echo "  ✗ $name：没有找到"$needle""
    FAIL=1
  fi
}

lacks() {
  local name="$1" haystack="$2" needle="$3"
  if printf '%s' "$haystack" | grep -qF -- "$needle"; then
    echo "  ✗ $name：不应出现"$needle""
    FAIL=1
  else
    echo "  ✓ $name"
  fi
}

echo "官网 $BASE"
check '首页' 200 "$(status "$BASE/")"
HOME_HTML="$(body "$BASE/")"
contains '首页主标题' "$HOME_HTML" '找到同频的游戏搭子'
lacks '正式站不应 noindex' "$HOME_HTML" 'noindex'
contains '首页 CSP' "$(header "$BASE/" content-security-policy)" "script-src 'self'"
contains '首页禁用麦克风' "$(header "$BASE/" permissions-policy)" 'microphone=()'
for p in /features/ /games/ /games/split-fiction/ /games/stardew-valley/ /games/terraria/ /games/monster-hunter/ /download/ /about/ /support/; do
  check "$p" 200 "$(status "$BASE$p")"
done
check '无结尾斜杠 301' 301 "$(status "$BASE/games/terraria")"
contains '301 指向规范地址' "$(header "$BASE/games/terraria" location)" '/games/terraria/'
check '不存在的官网页面是真实 404' 404 "$(status "$BASE/games/not-a-game/")"
check '404 页面不能直接以 200 访问' 404 "$(status "$BASE/404.html")"
check 'robots.txt' 200 "$(status "$BASE/robots.txt")"
contains 'robots 声明站点地图' "$(body "$BASE/robots.txt")" "Sitemap: $BASE/sitemap.xml"
check 'sitemap.xml' 200 "$(status "$BASE/sitemap.xml")"
check 'llms.txt' 200 "$(status "$BASE/llms.txt")"

echo "业务路由（不能被官网接管）"
check '网页版' 200 "$(status "$BASE/web/")"
contains '网页版保留自己的 CSP（含语音所需配置）' "$(header "$BASE/web/" content-security-policy)" 'wasm-unsafe-eval'
contains '网页版保留麦克风权限' "$(header "$BASE/web/" permissions-policy)" 'microphone=(self)'
check '后端健康检查' 200 "$(status "$BASE/api/health/ready")"
contains '接口返回 JSON 而不是官网页面' "$(header "$BASE/api/health/ready" content-type)" 'json'
check '隐私政策' 200 "$(status "$BASE/legal/privacy-policy.html")"
check '协议目录' 200 "$(status "$BASE/legal/index.html")"
check 'Universal Links 关联文件' 200 "$(status "$BASE/.well-known/apple-app-site-association")"
SHARE="$(body "$BASE/s/smoke-test-not-a-token")"
lacks '分享落地页仍由后端处理' "$SHARE" '这个页面不存在'
IM_STATUS="$(status "$BASE/im")"
if [ "$IM_STATUS" = 200 ] || [ "$IM_STATUS" = 404 ]; then
  IM_BODY="$(body "$BASE/im")"
  lacks '/im 仍由后端处理（不是官网页面）' "$IM_BODY" '半拍官网'
else
  echo "  ✓ /im 由后端处理（$IM_STATUS）"
fi

if [ "$FAIL" -ne 0 ]; then
  echo "冒烟检查没有通过"
  exit 1
fi
echo "冒烟检查全部通过"
