#!/usr/bin/env node
/**
 * 构建产物检查（需求文档 AC06–AC09、12.3、20.1）。npm run build 的最后一步，失败时以非 0 退出：
 * - 每页：lang、唯一的 title 与 description、唯一 H1、标题不跳级、规范地址、robots、OG、图片 alt 与尺寸；
 * - CSP 兼容：没有内联脚本、内联样式，脚本只来自 /_site/；
 * - 结构化数据：能解析、组织名称与公司全称一致、页面地址与规范地址一致、没有评分 / 价格 / 下载量等字段、FAQ 与页面可见问答一致；
 * - 链接：站内链接都能找到对应文件（/legal/ 核对本机协议导出），外链只用 https 白名单域名；
 * - 站点地图、robots 与环境一致；src/assets 的素材都已登记且尺寸一致；首页脚本与主图体积在预算内。
 * 需要与构建时相同的 SITE_ENV / SITE_URL。
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'node-html-parser'
import sharp from 'sharp'
import { resolveSiteEnv } from '../src/lib/env.ts'
import { CONTENT_LINK_HOSTS } from '../src/lib/links.ts'
import { sitemapEntries } from '../src/lib/pages.ts'
import { loadSiteContent, ROOT } from './lib/content-node.mjs'
import { isReservedPath } from './lib/routes.mjs'

const DIST = path.join(ROOT, 'dist')
const ASSETS = path.join(ROOT, 'src/assets')
const LEGAL_EXPORT = path.resolve(ROOT, '../quanquan/src/main/resources/static/legal')
const BUDGET = { homeJsBytes: 80 * 1024, heroImageBytes: 300 * 1024 }
const FORBIDDEN_LD_KEYS = ['aggregateRating', 'review', 'reviews', 'offers', 'ratingValue', 'reviewCount', 'downloadCount', 'award', 'interactionStatistic']

const env = resolveSiteEnv(process.env)
const content = await loadSiteContent()
const errors = []
const warnings = []
const err = (where, msg) => errors.push(`${where}：${msg}`)
const warn = (where, msg) => warnings.push(`${where}：${msg}`)

async function exists(file) {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

async function walk(dir, prefix = '') {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      out.push(...(await walk(path.join(dir, entry.name), rel)))
    } else {
      out.push(rel)
    }
  }
  return out
}

function routeOf(rel) {
  if (rel === 'index.html') {
    return '/'
  }
  if (rel.endsWith('/index.html')) {
    return `/${rel.slice(0, -'index.html'.length)}`
  }
  return `/${rel}`
}

function deepKeys(value, out = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((v) => deepKeys(v, out))
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k)
      deepKeys(v, out)
    }
  }
  return out
}

const distFiles = await walk(DIST)
const distSet = new Set(distFiles)
const htmlFiles = distFiles.filter((f) => f.endsWith('.html'))
const titles = new Map()
const descriptions = new Map()
const pageIds = new Map()
const pendingLinks = []
const allowedHosts = new Set([...CONTENT_LINK_HOSTS, ...content.releases.allowedHosts])
const legalExportAvailable = await exists(LEGAL_EXPORT)
if (!legalExportAvailable) {
  warn('协议', `本机没有找到协议导出目录 ${LEGAL_EXPORT}，/legal/ 链接没有核对`)
}

for (const rel of htmlFiles) {
  const route = routeOf(rel)
  const is404 = rel === '404.html'
  const html = await readFile(path.join(DIST, rel), 'utf8')
  const root = parse(html)
  const where = route

  if (root.querySelector('html')?.getAttribute('lang') !== 'zh-CN') {
    err(where, '<html lang> 应为 zh-CN')
  }
  const titleEls = root.querySelectorAll('title')
  const title = titleEls[0]?.text.trim()
  if (titleEls.length !== 1 || !title) {
    err(where, '必须有且只有一个非空 <title>')
  } else if (titles.has(title)) {
    err(where, `标题与 ${titles.get(title)} 重复：${title}`)
  } else {
    titles.set(title, route)
  }
  const desc = root.querySelector('meta[name="description"]')?.getAttribute('content')?.trim()
  if (!desc) {
    err(where, '缺少 meta description')
  } else {
    if (descriptions.has(desc)) {
      err(where, `描述与 ${descriptions.get(desc)} 重复`)
    }
    descriptions.set(desc, route)
    if (desc.length < 30 || desc.length > 120) {
      warn(where, `描述 ${desc.length} 字，建议 60–100 字`)
    }
  }
  const h1s = root.querySelectorAll('h1')
  if (h1s.length !== 1) {
    err(where, `应有且只有一个 <h1>，现在 ${h1s.length} 个`)
  }
  const levels = root.querySelectorAll('h1, h2, h3, h4, h5, h6').map((h) => Number(h.tagName.slice(1)))
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) {
      err(where, `标题层级跳级：h${levels[i - 1]} 之后直接出现 h${levels[i]}`)
      break
    }
  }

  const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute('href')
  if (is404) {
    if (canonical) {
      err(where, '404 页面不应输出规范地址')
    }
  } else if (canonical !== `${env.siteUrl}${route}`) {
    err(where, `规范地址应为 ${env.siteUrl}${route}，现在是 ${canonical ?? '（缺失）'}`)
  }
  const robots = root.querySelector('meta[name="robots"]')?.getAttribute('content') ?? ''
  const shouldIndex = env.indexable && !is404
  if (shouldIndex && robots.includes('noindex')) {
    err(where, '正式页面不应 noindex')
  }
  if (!shouldIndex && !robots.includes('noindex')) {
    err(where, `${is404 ? '404 页面' : '非正式环境'}必须 noindex`)
  }
  for (const prop of ['og:title', 'og:description', 'og:image', 'og:url', 'og:image:alt']) {
    if (!root.querySelector(`meta[property="${prop}"]`)?.getAttribute('content')) {
      err(where, `缺少 ${prop}`)
    }
  }
  const ogImage = root.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? ''
  if (!ogImage.startsWith(`${env.siteUrl}/`)) {
    err(where, `OG 图片应在本站：${ogImage}`)
  } else if (!distSet.has(ogImage.slice(env.siteUrl.length + 1))) {
    err(where, `OG 图片文件不存在：${ogImage}（运行 npm run make:og 生成）`)
  }

  // ---- 脚本、样式（CSP） ----
  let ldCount = 0
  for (const s of root.querySelectorAll('script')) {
    const type = s.getAttribute('type')
    const src = s.getAttribute('src')
    if (type === 'application/ld+json') {
      ldCount++
      let data
      try {
        data = JSON.parse(s.text)
      } catch (error) {
        err(where, `JSON-LD 无法解析：${error.message}`)
        continue
      }
      checkJsonLd(where, data, canonical, root, is404)
    } else if (!src) {
      err(where, '有内联脚本（正式 CSP 不允许）')
    } else if (!src.startsWith('/_site/')) {
      err(where, `脚本应来自 /_site/：${src}`)
    } else if (!distSet.has(src.slice(1))) {
      err(where, `脚本文件不存在：${src}`)
    }
  }
  if (ldCount !== 1) {
    err(where, `应有一段 JSON-LD，现在 ${ldCount} 段`)
  }
  if (root.querySelectorAll('style').length) {
    err(where, '有内联 <style>（正式 CSP 不允许）')
  }
  if (root.querySelectorAll('[style]').length) {
    err(where, '有 style 属性（正式 CSP 不允许）')
  }
  for (const link of root.querySelectorAll('link[rel="stylesheet"]')) {
    const href = link.getAttribute('href') ?? ''
    if (!href.startsWith('/_site/') || !distSet.has(href.slice(1))) {
      err(where, `样式表应来自 /_site/ 且存在：${href}`)
    }
  }

  // ---- 图片 ----
  for (const img of root.querySelectorAll('img')) {
    if (!img.hasAttribute('alt')) {
      err(where, `图片缺少 alt：${img.getAttribute('src')}`)
    }
    if (!img.getAttribute('width') || !img.getAttribute('height')) {
      err(where, `图片缺少宽高（防止布局跳动）：${img.getAttribute('src')}`)
    }
  }

  // ---- 链接 ----
  pageIds.set(route, new Set(root.querySelectorAll('[id]').map((el) => el.getAttribute('id'))))
  for (const a of root.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') ?? ''
    if (!a.text.trim() && !a.getAttribute('aria-label')) {
      err(where, `链接没有可见文字或 aria-label：${href}`)
    }
    pendingLinks.push({ from: route, href })
  }

  if (/example\.(com|org|net)/i.test(html)) {
    err(where, '含有示例域名')
  }
  if (env.name === 'production' && /localhost|127\.0\.0\.1/.test(html)) {
    err(where, '正式构建里出现本机地址')
  }
}

function checkJsonLd(where, data, canonical, root, is404) {
  const graph = data?.['@graph']
  if (data?.['@context'] !== 'https://schema.org' || !Array.isArray(graph)) {
    err(where, 'JSON-LD 应为 schema.org 的 @graph')
    return
  }
  const typeOf = (node) => (Array.isArray(node['@type']) ? node['@type'] : [node['@type']])
  const find = (t) => graph.find((n) => typeOf(n).includes(t))
  const org = find('Organization')
  const app = find('SoftwareApplication')
  const page = graph.find((n) => typeOf(n).some((t) => ['WebPage', 'AboutPage', 'CollectionPage'].includes(t)))
  if (!find('WebSite') || !org || !app || !page) {
    err(where, 'JSON-LD 缺少 WebSite / Organization / SoftwareApplication / WebPage')
    return
  }
  if (org.name !== content.company.legalName) {
    err(where, `Organization.name 应为公司全称 ${content.company.legalName}`)
  }
  if (Boolean(app.publisher) !== content.company.operator.effective) {
    err(where, '产品的 publisher 只在公司成为生效运营主体后输出')
  }
  if (!is404 && page.url !== canonical) {
    err(where, `WebPage.url（${page.url}）与规范地址不一致`)
  }
  const keys = deepKeys(data)
  for (const k of FORBIDDEN_LD_KEYS) {
    if (keys.has(k)) {
      err(where, `JSON-LD 不应输出 ${k}（没有真实依据）`)
    }
  }
  if (typeOf(page).includes('FAQPage')) {
    const visible = new Set(root.querySelectorAll('details summary').map((s) => s.text.trim()))
    for (const q of page.mainEntity ?? []) {
      if (!visible.has(q.name)) {
        err(where, `FAQ 结构化数据里的问题在页面上看不到：${q.name}`)
      }
    }
  }
}

// ---- 站内链接与锚点 ----
for (const { from, href } of pendingLinks) {
  if (href.startsWith('mailto:')) {
    continue
  }
  if (href.startsWith('#')) {
    if (!pageIds.get(from)?.has(href.slice(1))) {
      err(from, `页内锚点不存在：${href}`)
    }
    continue
  }
  if (/^https?:\/\//.test(href)) {
    let url
    try {
      url = new URL(href)
    } catch {
      err(from, `外链地址不合法：${href}`)
      continue
    }
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) {
      err(from, `外链只允许 https 白名单域名：${href}`)
    }
    continue
  }
  if (!href.startsWith('/') || href.startsWith('//')) {
    err(from, `站内链接应以 / 开头：${href}`)
    continue
  }
  const [pathPart, hash] = href.split('#')
  const pathname = pathPart.split('?')[0]
  if (isReservedPath(pathname)) {
    if (pathname.startsWith('/legal/') && legalExportAvailable) {
      const file = pathname.slice('/legal/'.length) || 'index.html'
      if (!(await exists(path.join(LEGAL_EXPORT, file)))) {
        err(from, `协议页面不存在：${pathname}`)
      }
    } else if (pathname.startsWith('/web')) {
      if (!content.releases.web.enabled) {
        err(from, `网页版未开放，却链接了 ${href}`)
      }
    }
    continue
  }
  let rel
  if (pathname === '/') {
    rel = 'index.html'
  } else if (pathname.endsWith('/')) {
    rel = `${pathname.slice(1)}index.html`
  } else if (/\.[a-z0-9]+$/.test(pathname)) {
    rel = pathname.slice(1)
  } else {
    err(from, `目录型页面链接要带结尾斜杠：${href}`)
    continue
  }
  if (!distSet.has(rel)) {
    err(from, `站内链接找不到页面：${href}`)
    continue
  }
  if (hash) {
    const target = rel === 'index.html' ? '/' : `/${rel.replace(/index\.html$/, '')}`
    if (!pageIds.get(target)?.has(hash)) {
      err(from, `锚点不存在：${href}`)
    }
  }
}

// ---- 站点地图与 robots ----
const sitemap = await readFile(path.join(DIST, 'sitemap.xml'), 'utf8')
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
if (env.indexable) {
  const expected = sitemapEntries(content).map((e) => `${env.siteUrl}${e.path}`)
  if (locs.length !== expected.length || expected.some((u) => !locs.includes(u))) {
    err('sitemap.xml', '站点地图与可收录页面清单不一致')
  }
  for (const loc of locs) {
    const route = loc.slice(env.siteUrl.length)
    const rel = route === '/' ? 'index.html' : `${route.slice(1)}index.html`
    if (!distSet.has(rel)) {
      err('sitemap.xml', `地图里的页面不存在：${loc}`)
    }
  }
  if ([...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].some((m) => !/^\d{4}-\d{2}-\d{2}$/.test(m[1]))) {
    err('sitemap.xml', 'lastmod 应为 YYYY-MM-DD')
  }
} else if (locs.length) {
  err('sitemap.xml', '非正式环境的站点地图应为空')
}
const robotsTxt = await readFile(path.join(DIST, 'robots.txt'), 'utf8')
if (env.indexable) {
  if (!robotsTxt.includes(`Sitemap: ${env.siteUrl}/sitemap.xml`)) {
    err('robots.txt', '缺少正式域名的 Sitemap 声明')
  }
  if (!robotsTxt.includes('Disallow: /api/')) {
    err('robots.txt', '缺少 /api/ 的抓取限制')
  }
} else if (!/User-agent: \*\nDisallow: \/\n/.test(robotsTxt)) {
  err('robots.txt', '非正式环境应整站禁止抓取')
}
for (const f of ['404.html', 'robots.txt', 'sitemap.xml', 'llms.txt', 'favicon.ico', 'apple-touch-icon.png', 'icon-512.png']) {
  if (!distSet.has(f)) {
    err('产物', `缺少 ${f}`)
  }
}

// ---- 素材登记（AC07） ----
const registry = new Map(content.assets.map((a) => [a.path, a]))
for (const rel of await walk(ASSETS)) {
  if (rel.endsWith('.DS_Store')) {
    continue
  }
  const entry = registry.get(rel)
  if (!entry) {
    err('素材', `src/assets/${rel} 没有在 src/content/assets.yaml 登记`)
    continue
  }
  const meta = await sharp(path.join(ASSETS, rel)).metadata()
  if (meta.width !== entry.width || meta.height !== entry.height) {
    err('素材', `${rel} 实际尺寸 ${meta.width}×${meta.height}，登记的是 ${entry.width}×${entry.height}`)
  }
  if (entry.approvalState !== 'approved') {
    ;(env.name === 'production' ? err : warn)('素材', `${rel} 尚未审核通过（approvalState: ${entry.approvalState}）`)
  }
}
for (const p of registry.keys()) {
  if (!(await exists(path.join(ASSETS, p)))) {
    warn('素材', `assets.yaml 登记了不存在的文件：${p}`)
  }
}

// ---- 体积预算（20.1） ----
const home = parse(await readFile(path.join(DIST, 'index.html'), 'utf8'))
let jsBytes = 0
for (const s of home.querySelectorAll('script[src]')) {
  jsBytes += (await stat(path.join(DIST, s.getAttribute('src').slice(1)))).size
}
if (jsBytes > BUDGET.homeJsBytes) {
  err('体积', `首页自有脚本 ${(jsBytes / 1024).toFixed(1)} KB，超过 80 KB`)
}
const hero = home.querySelector('img[fetchpriority="high"]')
const heroSources = hero?.parentNode?.querySelectorAll('source') ?? []
let heroMax = 0
for (const source of heroSources) {
  for (const candidate of (source.getAttribute('srcset') ?? '').split(',')) {
    const url = candidate.trim().split(/\s+/)[0]
    if (url?.startsWith('/_site/')) {
      heroMax = Math.max(heroMax, (await stat(path.join(DIST, url.slice(1)))).size)
    }
  }
}
if (!hero) {
  err('体积', '首页没有找到首屏主图（fetchpriority="high"）')
} else if (heroMax > BUDGET.heroImageBytes) {
  err('体积', `首屏主图最大的现代格式版本 ${(heroMax / 1024).toFixed(0)} KB，超过 300 KB`)
}

// ---- 输出 ----
console.log(`产物检查（${env.name}，${env.siteUrl}）：${htmlFiles.length} 个页面，首页脚本 ${(jsBytes / 1024).toFixed(1)} KB，首屏主图最大 ${(heroMax / 1024).toFixed(0)} KB`)
for (const w of warnings) {
  console.log(`  ! ${w}`)
}
if (errors.length) {
  for (const e of errors) {
    console.error(`  ✗ ${e}`)
  }
  console.error(`产物检查没有通过：${errors.length} 项`)
  process.exit(1)
}
console.log('  ✓ 全部通过')
