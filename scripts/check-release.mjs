#!/usr/bin/env node
/**
 * 正式发布检查（需求文档 22.3、24.1）：下面任何一项是"✗"都不能发布正式站。
 *   - 正式域名：https、不是本机或示例域名；
 *   - 网站 ICP 备案号：已填写、格式正确、不是 App 备案号；
 *   - 联系渠道：至少一个经过验证的邮箱；
 *   - 素材：全部审核通过；
 *   - 产物：按正式环境构建（允许收录、站点地图非空）。
 * "!"是提醒项（不阻断）：公司运营主体是否已对齐、搜索平台验证码、公安联网备案号（网站开通后 30 日内办理，首次上线时可以还没有）等。
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { resolveSiteEnv, isLocalHost } from '../src/lib/env.ts'
import { filingReleaseChecks } from '../src/lib/filings.ts'
import { loadSiteContent, ROOT } from './lib/content-node.mjs'

const content = await loadSiteContent()
const failures = []
const notes = []
const ok = []

let env
try {
  env = resolveSiteEnv({ ...process.env, SITE_ENV: 'production' })
} catch (error) {
  failures.push(`正式域名：${error.message}`)
}

if (env) {
  const host = new URL(env.siteUrl).hostname
  if (isLocalHost(host) || /example\./.test(host)) {
    failures.push(`正式域名不能是 ${host}`)
  } else {
    ok.push(`正式域名 ${env.siteUrl}`)
  }
}

const { company, assets, settings, releases } = content
// 备案：ICP 缺失或不对是阻断项；公安联网备案号缺失只提醒（规则见 src/lib/filings.ts）
const filing = filingReleaseChecks(company.filings)
ok.push(...filing.ok)
notes.push(...filing.notes)
failures.push(...filing.failures)

const verified = company.contacts.filter((c) => c.verified)
if (!verified.length) {
  failures.push('没有经过验证的联系渠道（company.yaml → contacts[].verified）')
} else {
  ok.push(`联系渠道 ${verified.map((c) => `${c.label} ${c.value}`).join('、')}`)
  if (verified.every((c) => /@(gmail|outlook|hotmail|yahoo)\./i.test(c.value))) {
    notes.push('联系邮箱是境外个人邮箱，建议换成公司域名邮箱（与 App 协议里的联系邮箱一起改）')
  }
}

const pending = assets.filter((a) => a.approvalState !== 'approved')
if (pending.length) {
  failures.push(`还有 ${pending.length} 个素材未审核：${pending.map((a) => a.path).join('、')}`)
} else {
  ok.push(`素材 ${assets.length} 个，均已审核`)
}

if (!company.operator.effective) {
  notes.push('公司还不是半拍的生效运营主体（company.yaml → operator.effective = false）：页面显示"运营主体变更中、以协议为准"')
}
const v = settings.verification
if (!v.baidu || !v.google || !v.bing) {
  notes.push('搜索平台站点验证码未填全（site.yaml → verification）：上线后在百度搜索资源平台、Google Search Console、Bing Webmaster Tools 验证并提交站点地图')
}
if (!releases.channels.some((c) => c.status === 'available')) {
  notes.push('还没有已上线的下载渠道：首页主按钮显示"查看获取方式"')
}

try {
  const robots = await readFile(path.join(ROOT, 'dist/robots.txt'), 'utf8')
  const sitemap = await readFile(path.join(ROOT, 'dist/sitemap.xml'), 'utf8')
  if (/User-agent: \*\nDisallow: \/\n/.test(robots) || !sitemap.includes('<loc>')) {
    failures.push('dist/ 不是正式构建（robots 禁止抓取或站点地图为空）：请用 npm run build:production')
  } else if (env && !robots.includes(`Sitemap: ${env.siteUrl}/sitemap.xml`)) {
    failures.push('dist/ 的站点地图域名与 SITE_URL 不一致')
  } else {
    ok.push('dist/ 为正式构建')
  }
} catch {
  failures.push('没有找到 dist/：请先构建')
}

console.log('\n正式发布检查')
for (const line of ok) {
  console.log(`  ✓ ${line}`)
}
for (const line of notes) {
  console.log(`  ! ${line}`)
}
for (const line of failures) {
  console.log(`  ✗ ${line}`)
}
if (failures.length) {
  console.error(`\n不能发布：${failures.length} 项未满足`)
  process.exit(1)
}
console.log('\n可以发布')
