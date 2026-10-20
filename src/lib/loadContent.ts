/**
 * 读取并校验 src/content 下的全部内容（需求文档 FR19、AC07）：
 * 先逐个文件按 Schema 校验，再做跨文件检查（slug 唯一、游戏编码、渠道地址白名单、素材登记、占位内容……）。
 * 任何一条不通过都抛出 ContentError，列出全部问题，构建因此失败。
 * 只依赖传入的文件内容，Astro 页面（content.ts）和 Node 测试、脚本共用。
 */
import { parse as parseYaml } from 'yaml'
import type { z } from 'astro/zod'
import {
  AssetFileSchema,
  CompanySchema,
  FaqFileSchema,
  GamePageSchema,
  ProductSchema,
  ReleasesSchema,
  SiteSettingsSchema,
  type Asset,
  type Company,
  type Faq,
  type GamePage,
  type Product,
  type Releases,
  type SiteSettings,
} from './schema.ts'
import { BACKEND_GAME_CODES } from './gameCodes.ts'
import { CONTENT_LINK_HOSTS, extractLinks, hostOf, isAllowedHttpsUrl, isInternalPath, isSafeHref } from './links.ts'

export interface SiteContent {
  settings: SiteSettings
  company: Company
  product: Product
  releases: Releases
  /** 全部游戏页（含草稿），按 order 排序 */
  games: GamePage[]
  /** 已发布的游戏页 */
  publishedGames: GamePage[]
  faqs: Faq[]
  assets: Asset[]
}

export class ContentError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`官网内容校验没有通过（${problems.length} 项）：\n- ${problems.join('\n- ')}`)
    this.name = 'ContentError'
    this.problems = problems
  }
}

/** 网站 ICP 备案号：湘ICP备2026012345号-1（App 备案号以字母 A 结尾，不能用在网站上） */
export const ICP_PATTERN = /^[一-龥]ICP备\d{6,12}号(-\d{1,3})?$/
// 公安联网备案号的格式（PSB_TEXT_PATTERN、PSB_CODE_PATTERN）定义在 schema.ts，页脚与发布检查用 filings.ts

const PLACEHOLDER = /example\.(com|org|net)|占位|TODO|TBD|xxxx|test@|@test\./i

export interface LoadOptions {
  /** 日期检查的"今天"（YYYY-MM-DD，北京时间）；默认取当前时间 */
  today?: string
}

export function todayInShanghai(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/**
 * @param files 相对 src/content 的路径 → 文件内容，例如 { 'company.yaml': '…', 'games/terraria.yaml': '…' }
 */
export function loadContent(files: Readonly<Record<string, string>>, options: LoadOptions = {}): SiteContent {
  const problems: string[] = []
  const today = options.today ?? todayInShanghai()

  function read<S extends z.ZodType>(path: string, schema: S): z.infer<S> | null {
    const source = files[path]
    if (source === undefined) {
      problems.push(`${path}：文件不存在`)
      return null
    }
    let data: unknown
    try {
      data = path.endsWith('.json') ? JSON.parse(source) : parseYaml(source, { uniqueKeys: true })
    } catch (error) {
      problems.push(`${path}：无法解析（${(error as Error).message.split('\n')[0]}）`)
      return null
    }
    const result = schema.safeParse(data)
    if (!result.success) {
      for (const issue of result.error.issues) {
        problems.push(`${path}：${issue.path.join('.') || '(根)'} ${issue.message}`)
      }
      return null
    }
    return result.data
  }

  const settings = read('site.yaml', SiteSettingsSchema)
  const company = read('company.yaml', CompanySchema)
  const product = read('product.yaml', ProductSchema)
  const releases = read('releases.json', ReleasesSchema)
  const faqFile = read('faqs.yaml', FaqFileSchema)
  const assetFile = read('assets.yaml', AssetFileSchema)

  const games: GamePage[] = []
  for (const path of Object.keys(files).filter((p) => p.startsWith('games/')).sort()) {
    if (!path.endsWith('.yaml')) {
      problems.push(`${path}：游戏页只能是 .yaml 文件`)
      continue
    }
    const game = read(path, GamePageSchema)
    if (!game) {
      continue
    }
    const expected = path.slice('games/'.length, -'.yaml'.length)
    if (game.slug !== expected) {
      problems.push(`${path}：slug（${game.slug}）必须与文件名一致`)
    }
    games.push(game)
  }

  // ---------------- 跨文件规则 ----------------
  const assets = assetFile?.assets ?? []
  checkUnique(assets.map((a) => a.path), '素材 path', problems)
  const assetPaths = new Set(assets.map((a) => a.path))

  if (company) {
    checkCompany(company, problems)
  }
  if (releases) {
    checkReleases(releases, problems)
  }
  if (product && faqFile) {
    checkFaqs(faqFile.faqs, product, today, problems)
  }
  checkGames(games, assetPaths, today, problems)

  // 占位内容：示例域名、占位邮箱等不能出现在任何内容文件里
  for (const [path, source] of Object.entries(files)) {
    const hit = source.match(PLACEHOLDER)
    if (hit) {
      problems.push(`${path}：含有占位内容"${hit[0]}"`)
    }
  }

  if (problems.length || !settings || !company || !product || !releases || !faqFile) {
    throw new ContentError(problems.length ? problems : ['内容文件缺失'])
  }

  games.sort((a, b) => a.order - b.order)
  return {
    settings,
    company,
    product,
    releases,
    games,
    publishedGames: games.filter((g) => g.status === 'published'),
    faqs: faqFile.faqs,
    assets,
  }
}

function checkUnique(values: readonly string[], what: string, problems: string[]): void {
  const seen = new Set<string>()
  for (const v of values) {
    if (seen.has(v)) {
      problems.push(`${what} 重复：${v}`)
    }
    seen.add(v)
  }
}

function checkCompany(company: Company, problems: string[]): void {
  checkUnique(company.contacts.map((c) => c.id), '联系渠道 id', problems)
  const icp = company.filings.icp
  if (icp !== null) {
    if (/A$/i.test(icp)) {
      problems.push(`company.yaml：${icp} 是 App 备案号，不能作为网站 ICP 备案号`)
    } else if (!ICP_PATTERN.test(icp)) {
      problems.push(`company.yaml：网站 ICP 备案号格式不对：${icp}`)
    }
  }
  // 公安联网备案号（filings.psb 的 text 与 code）的格式与一致性由 PsbFilingSchema 校验
}

function checkReleases(releases: Releases, problems: string[]): void {
  checkUnique(releases.channels.map((c) => c.id), '下载渠道 id', problems)
  const hosts = new Set(releases.allowedHosts)
  for (const c of releases.channels) {
    const where = `releases.json 渠道 ${c.id}`
    const needsUrl = c.status === 'available' || c.status === 'beta'
    if (needsUrl) {
      if (!c.url) {
        problems.push(`${where}：${c.status} 必须填写真实地址`)
      } else if (!isAllowedHttpsUrl(c.url, hosts)) {
        problems.push(`${where}：地址必须是 https 且域名在 allowedHosts 里：${c.url}`)
      }
    }
    if (c.status === 'available' && (!c.version || !c.releasedAt)) {
      problems.push(`${where}：available 必须填写 version 与 releasedAt`)
    }
    if (c.status === 'beta' && !c.betaScope) {
      problems.push(`${where}：beta 必须写明测试范围 betaScope`)
    }
    if ((c.status === 'coming_soon' || c.status === 'maintenance' || c.status === 'unsupported') && !c.note) {
      problems.push(`${where}：${c.status} 必须填写 note（当前状态或替代途径）`)
    }
    if (c.kind === 'apk') {
      if (c.platform !== 'android') {
        problems.push(`${where}：安装包只能用于 android`)
      }
      if (c.status === 'available' && !c.apk) {
        problems.push(`${where}：安装包必须提供 sizeBytes 与 sha256`)
      }
    } else if (c.apk) {
      problems.push(`${where}：只有 apk 渠道填写 apk 信息`)
    }
    if ((c.kind === 'app_store' || c.kind === 'testflight') && c.platform !== 'ios') {
      problems.push(`${where}：${c.kind} 只能用于 ios`)
    }
    if (!needsUrl && c.url) {
      problems.push(`${where}：${c.status} 状态不应填写地址（避免对外暴露未开放的链接）`)
    }
  }
  const web = releases.web.url
  if (!(web.startsWith('/web/') && isInternalPath(web)) && !isAllowedHttpsUrl(web, hosts)) {
    problems.push(`releases.json：网页版地址只能是 /web/ 开头的同域路径或 allowedHosts 内的 https 地址：${web}`)
  }
}

function checkFaqs(faqs: readonly Faq[], product: Product, today: string, problems: string[]): void {
  checkUnique(faqs.map((f) => f.id), 'FAQ id', problems)
  const requirable = new Set([...Object.keys(product.capabilities), 'web'])
  for (const f of faqs) {
    if (f.requires && !requirable.has(f.requires)) {
      problems.push(`faqs.yaml ${f.id}：requires 只能是 product.capabilities 里的键或 web，收到 ${f.requires}`)
    }
    if (f.updatedAt > today) {
      problems.push(`faqs.yaml ${f.id}：updatedAt 不能晚于今天`)
    }
    checkTextLinks(`faqs.yaml ${f.id}`, f.answer, problems)
  }
}

function checkTextLinks(where: string, source: string, problems: string[]): void {
  for (const link of extractLinks(source)) {
    if (!isSafeHref(link.href)) {
      problems.push(`${where}：链接不在白名单里：${link.href}`)
    }
  }
}

function checkGames(games: readonly GamePage[], assetPaths: ReadonlySet<string>, today: string, problems: string[]): void {
  checkUnique(games.map((g) => g.slug), '游戏页 slug', problems)
  checkUnique(games.map((g) => String(g.order)), '游戏页 order', problems)
  checkUnique(games.flatMap((g) => g.titles.map((t) => t.code)), '游戏编码', problems)
  const published = new Set(games.filter((g) => g.status === 'published').map((g) => g.slug))
  for (const g of games) {
    const where = `games/${g.slug}.yaml`
    if (g.status === 'published' && !g.titles.some((t) => t.supportStatus === 'open')) {
      problems.push(`${where}：已发布的游戏页至少要有一个已开放（open）的作品`)
    }
    for (const t of g.titles) {
      if (t.supportStatus === 'open' && !BACKEND_GAME_CODES.has(t.code)) {
        problems.push(`${where}：${t.code} 不在后端游戏字典里（src/lib/gameCodes.ts），不能标为已开放`)
      }
      if (t.supportStatus === 'open' && t.openPlatforms.length === 0) {
        problems.push(`${where}：已开放的 ${t.name} 要写明开放的平台`)
      }
      if (!isAllowedHttpsUrl(t.officialSite, CONTENT_LINK_HOSTS)) {
        problems.push(`${where}：官方网站域名不在白名单里：${hostOf(t.officialSite) ?? t.officialSite}`)
      }
    }
    for (const fact of g.compatibility.officialFacts) {
      if (!isAllowedHttpsUrl(fact.sourceUrl, CONTENT_LINK_HOSTS)) {
        problems.push(`${where}：官方来源域名不在白名单里：${hostOf(fact.sourceUrl) ?? fact.sourceUrl}`)
      }
    }
    if (g.compatibility.checkedAt > today || g.updatedAt > today) {
      problems.push(`${where}：核对日期、更新日期不能晚于今天`)
    }
    checkUnique(g.faqs.map((f) => f.id), `${where} FAQ id`, problems)
    for (const f of g.faqs) {
      checkTextLinks(`${where} ${f.id}`, f.answer, problems)
    }
    for (const r of g.related) {
      if (r === g.slug) {
        problems.push(`${where}：related 不能包含自己`)
      } else if (g.status === 'published' && !published.has(r)) {
        problems.push(`${where}：related 里的 ${r} 不存在或未发布`)
      }
    }
    if (g.screen !== null) {
      if (!assetPaths.has(`screens/${g.screen}.png`)) {
        problems.push(`${where}：截图 screens/${g.screen}.png 没有在 assets.yaml 登记`)
      }
      if (!g.screenAlt) {
        problems.push(`${where}：有截图时必须填写 screenAlt`)
      }
    } else if (g.demoParties.length === 0) {
      problems.push(`${where}：screen 与 demoParties 至少要有一个`)
    }
    checkTextLinks(where, g.lead, problems)
  }
}
