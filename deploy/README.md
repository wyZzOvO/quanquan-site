# 官网部署与回滚

官网是纯静态文件，放在与后端、网页版同一台服务器（`ubuntu@62.234.35.78`）的 `/var/www/quanquan-site/`，
由 `www.monster-ovo.cn` 的 nginx 直接提供；不需要 Node 进程，不改后端和网页版。

```text
/var/www/quanquan-site/
  releases/<时间>-<git 短哈希>/   每次发布一个目录，默认保留最近 5 个
  current -> releases/…          nginx 读取的版本（原子切换）
  releases.log                   发布与回滚记录（时间、版本、执行人、上一版）
```

## 前提

- 网站 ICP 备案已完成并填进 `src/content/company.yaml`（`npm run build:production` 会检查，没有就中止）。
- 服务器账号可以免密 sudo（首次接管根地址时要改 nginx）。
- 本机能 ssh 到服务器（密钥登录；sshd 偶尔在握手前断开，脚本会自动重试）。

## 首次上线

```bash
cd ~/quanquan-site
ssh ubuntu@62.234.35.78 'sudo mkdir -p /var/www/quanquan-site && sudo chown ubuntu:ubuntu /var/www/quanquan-site'
./deploy/deploy.sh          # 单测 → 正式构建与检查 → 上传 → 切换 current → 冒烟检查（此时根地址还是跳 /web/，冒烟会提示首页不对，属正常）
./deploy/install-nginx.sh   # 接管根地址：装 nginx 片段、去掉网页版片段里的根地址跳转、nginx -t 通过才重载，不通过自动还原
./deploy/smoke.sh           # 官网页面、状态码、安全响应头，以及 /web/、/api/、/legal/、/s/、/.well-known/、/im 没有被接管
```

`install-nginx.sh` 做的事：

1. 第一次执行时备份站点配置和网页版片段：`/etc/nginx/www.monster-ovo.cn.conf.bak-before-site`、`/etc/nginx/quanquan-web.conf.bak-before-site`。
2. 装上 `/etc/nginx/snippets/quanquan-site.conf`（路由）与 `quanquan-site-headers.conf`（安全响应头）。
3. 删掉 `/etc/nginx/snippets/quanquan-web.conf` 里"根地址 302 到 /web/"那一段（`/web` → `/web/` 的跳转保留）。
4. 在 443 server 里网页版 include 的下一行加 `include snippets/quanquan-site.conf;`。

官网只接管明确列出的路径（`/`、`/features/`、`/games/`、`/download/`、`/about/`、`/support/`、`/_site/`、`/og/`、`/robots.txt`、`/sitemap.xml`、`/llms.txt`、图标），
其他路径继续走原来的 `location /`（反代后端），所以以后新增的后端路由不需要改官网配置。`tests/nginx.test.ts` 会检查片段不会匹配业务路由。

注意：nginx 的 `add_header` 在 location 里出现后不会继承 server 级的设置。如果站点配置在 server 级设置了 HSTS 等响应头，
需要同时加到 `quanquan-site-headers.conf` 里。

quanquan 仓库的 `deploy/nginx/quanquan-web.conf` 已经用 `# >>> root-redirect` / `# <<< root-redirect` 标出根地址跳转；
服务器上有官网片段时，重跑 `install-web-nginx.sh` 会自动去掉这一段，不会和官网冲突。

## 日常发布

```bash
./deploy/deploy.sh
```

发布时会把上一版带哈希的 `_site/` 资源补进新版本，已经打开的旧页面不会因为找不到旧资源而出错。HTML 每次校验（`no-cache`），
`/_site/` 一年强缓存（`immutable`），`/og/` 缓存一天。

## 回滚

- 只回退官网内容（15 分钟内恢复的目标）：`./deploy/rollback.sh`（切回上一版），或 `./deploy/rollback.sh <releases 下的目录名>`。
- 撤销根地址接管（恢复成根地址跳 `/web/`）：

  ```bash
  ssh ubuntu@62.234.35.78 'sudo cp -p /etc/nginx/www.monster-ovo.cn.conf.bak-before-site /etc/nginx/conf.d/www.monster-ovo.cn.conf \
    && sudo cp -p /etc/nginx/quanquan-web.conf.bak-before-site /etc/nginx/snippets/quanquan-web.conf \
    && sudo nginx -t && sudo systemctl reload nginx'
  ```

  官网故障不影响 `/web/`、`/api/` 等业务入口（路由互相独立）。

## 换域名

如果改用公司名下的新域名：设置 `SITE_URL=https://新域名` 构建发布；新域名单独一个 nginx server（证书、备案就绪），
把 `quanquan-site.conf` include 进去即可（新域名上没有业务路由时，可以把其余路径统一 404）。旧域名的官网页面按页面一一 301 到新域名，
至少保留一年；同时更新搜索平台、站点地图提交和对外资料。网页版若也要迁移，要另外验证 Cookie、CSRF、WebSocket Origin、App 关联文件与第三方回调。
