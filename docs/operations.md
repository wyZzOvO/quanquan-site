# 官网运营手册

适用对象：公司负责人、产品、运营。所有对外事实（公司、产品能力、下载渠道、游戏支持范围）都在 `src/content/` 里维护，
改完执行 `npm test && npm run build`，通过后再按 [deploy/README.md](../deploy/README.md) 发布。

## 一、常见改动

### App 上架后更新下载渠道

编辑 `src/content/releases.json`：

1. 把对应渠道的 `status` 改为 `available`，填写 `url`（必须是 https，域名要在 `allowedHosts` 里，例如 `apps.apple.com`）、`version`、`releasedAt`，可选 `requirement`（如"需要 iOS 15.0 或更高版本"），`note` 改为 `null`。
2. Android 有多个商店时，每个商店一条渠道（`kind: android_store`，`label` 写商店名）；新商店域名先加进 `allowedHosts`。
3. 提供官方安装包时用 `kind: apk`，必须填 `apk.sizeBytes` 与 `apk.sha256`（正式签名包的 SHA-256），安装包放在正式下载存储，不要放进本仓库。
4. 改 `updatedAt` 为当天。首页主按钮会自动从"查看获取方式"变成"下载玉米圈"，结构化数据的 `operatingSystem` 也会加上对应平台。

测试版用 `status: beta` 并写 `betaScope`；维护中用 `maintenance` 并在 `note` 写替代途径；不再支持用 `unsupported`。未开放的渠道不要填地址。

### 公司成为玉米圈的生效运营主体

协议、隐私政策、应用商店开发者、App 备案都已变更为公司后：`company.yaml → operator.effective: true`。
首页底部、关于页、下载页会显示"玉米圈由长沙半亩晴空信息科技有限公司运营"，结构化数据加上产品的 publisher。

### 填写备案号

`company.yaml → filings.icp`（如 `湘ICP备2026012345号-1`）、`filings.psb`（两项：`text` 完整文字如 `湘公网安备43010202000000号`，
`code` 14 位编号如 `"43010202000000"`，要加引号；构建会核对两项的编号一致）。App 备案号（以 A 结尾）会被拒绝。
页脚会显示备案号并链接到工信部 / 公安备案查询网站，公安备案号前面自动显示本站自制的公安备案图标。
公安备案号没填时页脚不显示，正式发布检查只提醒、不拦截（网站开通后 30 日内办理）。

### 更换联系邮箱

`company.yaml → contacts`。至少一个 `verified: true`（真实收发、有人维护）。换邮箱时同步改 App 协议里的联系邮箱（ju-mobile `lib/legal/legal_info.dart` 的 `kContactEmail`）。

### 某项能力下线或暂停

`product.yaml → capabilities` 把对应项改为 `false`，首页、功能页的相关段落与 FAQ 会自动隐藏。网页版暂停时把 `releases.json → web.enabled` 改为 `false`，全站"进入网页版"入口会消失。

### 更新游戏页

- 玉米圈里开放了新平台（后台发布了新的平台矩阵）：改对应 `games/*.yaml` 的 `openPlatforms`、`platformNote`、`productNotes` 与 FAQ。
- 游戏官方规则变化：改 `compatibility.officialFacts`（每条都要有官方来源链接），把 `checkedAt` 改为核对当天；内容有实质变化时同时改 `updatedAt`。
  来源只能用官方网站、官方论坛或商店页（域名白名单在 `src/lib/links.ts`，新增官方域名时加进去）。
- 新开放一部作品（如怪物猎人 崛起：曙光）：把对应作品的 `supportStatus` 改为 `open` 并写上开放平台；作品编码必须已在后端游戏字典里（`src/lib/gameCodes.ts`）。

建议每月核对一次各游戏的官方规则（泰拉瑞亚 1.4.6 的主机跨平台、怪物猎人 荒野 Switch 2 版等近期可能变化）。

### 新增一款游戏专题

复制一份 `games/*.yaml` 改写全部内容（禁止只替换名称批量复制），`order` 不重复，`art` 需要新增一张原创插画（`src/components/GameArt.astro`），
截图要登记在 `assets.yaml`，再执行 `npm run make:og` 生成分享图。没有专门内容、素材和维护人的游戏不要上专题页。

### 更新产品截图

1. 在 ~/quanquan-web 启动演示模式：`npm run dev -- --mode mock --strictPort`。
2. 在本仓库执行 `npm run capture:screens`，截图写到 `src/assets/screens/`（只含演示数据）。
3. 核对 `assets.yaml` 里的尺寸，确认画面里没有真实用户信息、没有尚未上线的功能，再 `npm run make:og`、`npm run build`。

## 二、上线后的搜索平台

1. 百度搜索资源平台、Google Search Console、Bing Webmaster Tools：用公司账号添加站点，选择 HTML 标签验证，把验证码填进 `site.yaml → verification`，发布后完成验证。
2. 在三个平台提交 `https://域名/sitemap.xml`，用平台的"抓取诊断 / 网址检查"确认首页与游戏页能抓取、渲染正常、规范地址正确。
3. 收录和排名是持续观察项，不以 `site:` 查询的数量作为精确收录量。

## 三、GEO 观察（上线后第 2、4、8 周）

在能联网检索的产品里（如豆包、通义、元宝、DeepSeek、Kimi、ChatGPT 搜索、Perplexity 等）逐条提问，每个问题问 3 次，记录在表格里。
未联网回答与联网检索的结果分开记录；结果只看趋势，不当作大样本统计。

| 编号 | 固定问题 |
| --- | --- |
| Q01 | 玉米圈是什么？ |
| Q02 | 玉米圈由哪个公司运营？ |
| Q03 | 玉米圈怎么下载？ |
| Q04 | 哪里找双影奇境搭子？ |
| Q05 | 怎样找星露谷长期农友？ |
| Q06 | 泰拉瑞亚组队需要确认什么？ |
| Q07 | 怪物猎人不同作品怎么找猎友？ |
| Q08 | 玉米圈收费吗？ |
| Q09 | 玉米圈的语音开黑怎么用？需要麦克风权限吗？ |
| Q10 | 玉米圈支持跨平台吗？ |
| Q11 | 玉米圈怎么注销账号、怎么联系客服？ |
| Q12 | 玉米圈有网页版吗？ |

记录字段：日期、产品与模式（联网 / 未联网）、完整问题、答案摘要、引用的网址、事实错误。指标：

- 品牌事实准确率：答案里关键的公司与产品事实正确的比例。
- 官网引用：固定问题里引用了官网页面的次数。
- 可识别的 AI 访问：来源明确是 AI 产品的官网访问（直接访问不强行归为 AI）。

发现事实错误时，先检查官网对应页面是否清楚、是否过期，再修正官网与对外资料；不承诺"AI 一定推荐"。

## 四、维护节奏与责任

| 频率 | 内容 | 负责 |
| --- | --- | --- |
| 每周 | 下载渠道是否可用、支持邮件、主要访问路径 | 运营 |
| 每月 | 游戏官方规则与开放平台、产品截图、协议链接、品牌事实；域名、证书、备案、商店链接、素材来源 | 产品 / 公司负责人 |
| 每次 App 正式发版 | 官网能力描述、最低系统要求、下载渠道版本 | 发布负责人 |
| 第 2、4、8 周 | SEO 收录与 GEO 观察 | 运营 |

一个人兼多个角色时也保留这份分工，避免关键资料没人维护。
