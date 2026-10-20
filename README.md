# 半亩晴空 / 玉米圈官网（quanquan-site）

长沙半亩晴空信息科技有限公司的官方网站，以玉米圈为核心产品。需求依据：《半亩晴空与玉米圈官网建设需求及技术文档 V1.0》（2026-10-19）。

- **技术栈**：Astro 7（静态生成）+ TypeScript（strict）+ 原生 CSS。产物是纯静态 HTML，没有常驻服务、数据库和第三方脚本。
- **页面**：首页、功能、游戏总览、四个游戏专题（双影奇境、星露谷物语、泰拉瑞亚、怪物猎人）、下载、关于半亩晴空、支持、404，
  以及 `robots.txt`、`sitemap.xml`、`llms.txt`。协议沿用现有的 `/legal/*.html`（由 App 协议源导出，见 quanquan 仓库），官网只链接不另写。
- **部署**：现有域名根路径（`https://www.monster-ovo.cn/`），`/web/`、`/api/`、`/im`、`/legal/`、`/s/`、`/r/`、`/t/`、`/creator`、`/.well-known/` 继续由原来的服务处理。详见 [deploy/README.md](deploy/README.md)。
- **备案**：没有网站 ICP 备案号时正式构建会被拦下。2026-10-19 起暂用域名现有的网站备案号 `京ICP备2024092535号-1`（个人主体）上线，公司备案通过后替换，见 [docs/filing-plan.md](docs/filing-plan.md)。

## 常用命令

```bash
npm install              # 依赖版本写死在 package.json 与 package-lock.json
npm run dev              # 本地开发 http://localhost:4321
npm test                 # 单元测试（内容校验、下载状态、链接白名单、结构化数据、robots、nginx 路由）
npm run build            # 预览构建：类型检查 → 构建 → 产物检查（页面 noindex，robots 禁止抓取）
npm run build:production # 正式构建：再加正式发布检查（备案号、联系渠道、素材审核……）
npm run preview          # 按正式 nginx 规则在 http://localhost:4322 预览 dist/（状态码、301、安全响应头都一致）
```

Node 版本见 `.node-version`（≥ 22.22）。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `SITE_ENV` | `production` / `preview` / `development`。只有 `production` 允许收录；`npm run build` 默认 `preview` |
| `SITE_URL` | 站点根地址，默认 `https://www.monster-ovo.cn`。换域名时设置它，规范地址、站点地图、OG、JSON-LD 一起变 |

## 内容在哪里改

运营要更新的内容都在 `src/content/`，改完执行 `npm test && npm run build`，字段写错会直接报出是哪个文件哪一项。

| 文件 | 内容 |
| --- | --- |
| `company.yaml` | 公司全称、简介、运营主体是否已生效（`operator.effective`）、联系邮箱、网站 ICP 与公安备案号 |
| `product.yaml` | 统一产品定义、已开放能力的开关（关掉的能力不在官网宣传）、最低年龄、收费说明 |
| `releases.json` | 下载渠道（`available` / `beta` / `coming_soon` / `maintenance` / `unsupported`）、网页版入口 |
| `games/*.yaml` | 游戏专题：场景、组队约定、三步说明、玉米圈当前开放的平台、带来源的官方规则、FAQ |
| `faqs.yaml` | 支持中心 FAQ |
| `assets.yaml` | 图片素材与授权登记（`src/assets` 下每个文件都要登记、尺寸一致、审核通过） |
| `site.yaml` | 搜索平台验证码、训练爬虫开关、商标说明 |

更细的操作步骤（上架后改下载渠道、加一款游戏、更新截图、SEO / GEO 观察）见 [docs/operations.md](docs/operations.md)。

## 目录

```text
src/content/        运营可编辑的内容（YAML / JSON，构建时按 Schema 校验）
src/lib/            内容模型与校验、下载状态、链接白名单、SEO 与结构化数据、robots、站点地图（纯函数，Node 测试直接引用）
src/pages/          页面与 robots.txt、sitemap.xml、llms.txt
src/layouts/        全站布局（<head> 元信息、JSON-LD、顶栏、页脚）
src/components/     手机外框、游戏卡片与原创插画、语音房示意、FAQ、二维码、复制按钮……
src/scripts/        少量原生脚本：移动端菜单、入场动效、FAQ 锚点、复制、下载页设备提示（首页合计约 1.2 KB）
src/styles/         设计令牌与基础样式
src/assets/         产品截图（演示数据）与品牌标识
public/             favicon、分享图（og/）
scripts/            构建入口、产物检查、正式发布检查、本地预览服务器、截图 / 图标 / 分享图生成
tests/              单元测试
deploy/             nginx 片段、首次接管根地址、发布、回滚、冒烟检查
docs/               运营手册、验收记录
```

## 设计要点

- 参考 Apple 官网的留白、字号层级和分段叙事：白与浅灰交替，中部一段深色语音场景，产品放在自制的手机外框里；
  主色沿用 App 的 `#7B61FF`（按钮与链接用加深的 `#654AF0`，白字对比度 5.5:1），玉米黄只做点缀。
- 字体只用系统字体（PingFang SC / 微软雅黑等），不加载外部字体。
- 产品截图来自网页版本地演示模式（`npm run capture:screens`，需要先在 ~/quanquan-web 启动 `npm run dev -- --mode mock`），只含演示数据，页面统一标注"界面示意"；
  截图前隐藏了演示数据里的"在等 N 人"等人数统计和内测中的 AI 入口。
- 游戏插画是原创矢量图形（`src/components/GameArt.astro`），没有使用任何游戏官方素材。
- 无障碍：键盘可达、焦点可见、减弱动效时关闭动画、禁用脚本时正文与链接照常可用；320 宽无横向滚动。

## SEO 与 GEO

- 每页独立的 title、description、H1、规范地址、OG 图；`lang="zh-CN"`；百度移动适配（`applicable-device`、`no-transform`）。
- JSON-LD：Organization（公司全称，别名"半亩晴空"）、WebSite、SoftwareApplication（玉米圈）、WebPage、BreadcrumbList，
  有可见问答的页面加 FAQPage；游戏页用 VideoGame 指向官方网站。不输出评分、评论、价格、下载量；公司成为生效运营主体前不输出产品的 publisher。
- `sitemap.xml` 只列可收录页面，lastmod 用内容的实质更新日期；`robots.txt` 允许搜索与 AI 检索爬虫，接口不抓取，训练爬虫由 `site.yaml` 单独控制；
  分享与推广落地页靠自带的 noindex 处理，不在 robots 里屏蔽。
- 游戏页把"游戏官方规则（带来源与核对日期）""玉米圈当前开放的能力""组队前要确认的事"分开写，便于搜索与生成式引擎准确引用。
- `llms.txt` 是给采用这一约定的系统的公开导航，内容与网页同源，不是收录保证。

## 上线前必须完成

1. **网站 ICP 备案**（已决定沿用 `www.monster-ovo.cn`，步骤见 [docs/filing-plan.md](docs/filing-plan.md)）：现有备案是北京的个人主体，
   公司登记在湖南，不能直接变更，要注销原备案后由公司在湖南重新备案网站和 App；注销到新备案通过之间，这个域名上的 App 接口和网页版都会中断。
   拿到备案号后填 `company.yaml → filings.icp`（`京ICP备2024092535号-1A` 是 App 备案号，不能用于网站，构建会拒绝）。
2. **公安联网备案**：按属地公安机关的要求办理（通常要求网站开通后 30 日内，填报指南见 quanquan 仓库 `docs/psb-filing/README.md`），
   取得后填 `filings.psb` 的 `text`（完整文字）与 `code`（14 位编号），页脚自动显示公安备案图标并链接到查询页；没填时正式发布检查只提醒。
3. **运营主体对齐**：协议、应用商店开发者、App 备案都变更为公司后，把 `operator.effective` 改为 `true`。
4. **联系邮箱**：目前沿用协议里公布的邮箱；建议启用公司域名邮箱，与 App 协议里的联系邮箱一起改。
5. **搜索平台**：上线后在百度搜索资源平台、Google Search Console、Bing Webmaster Tools 验证域名，验证码填 `site.yaml`，提交站点地图。
