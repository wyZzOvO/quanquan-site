/**
 * 元信息与结构化数据（需求文档 15、16、17 章）。
 * JSON-LD 只用页面上可见、配置里真实存在的信息：不输出评分、评论、价格、下载次数；
 * 公司成为玉米圈的生效运营主体之前，不写产品的 publisher 关系。
 */
import type { Company, Product, Releases } from './schema.ts'
import { availablePlatforms } from './downloads.ts'
import { plainText } from './links.ts'

export interface Crumb {
  name: string
  path: string
}

export interface FaqItem {
  question: string
  answer: string
}

export interface VideoGameRef {
  name: string
  alternateName: string
  sameAs: string
}

export interface PageSeo {
  /** 规范路径（目录型页面以 / 结尾） */
  path: string
  title: string
  description: string
  keywords?: readonly string[]
  /** OG 图片路径（public 下，1200×630） */
  ogImage: string
  ogImageAlt: string
  /** 不含首页本身；首页传空数组 */
  breadcrumbs: readonly Crumb[]
  pageType?: 'WebPage' | 'AboutPage' | 'CollectionPage'
  /** 页面主题：产品（默认）或公司 */
  about?: 'product' | 'organization'
  /** 页面提到的游戏（游戏页） */
  videoGames?: readonly VideoGameRef[]
  faqs?: readonly FaqItem[]
  /** 内容实质更新日期 YYYY-MM-DD */
  dateModified: string
  /** 404 等不收录的页面传 false */
  indexable?: boolean
}

export interface JsonLdContext {
  siteUrl: string
  siteName: string
  company: Company
  product: Product
  releases: Releases
  /** 公司标识（绝对地址、尺寸） */
  logo: { url: string; width: number; height: number }
}

export function absoluteUrl(siteUrl: string, path: string): string {
  return new URL(path, `${siteUrl}/`).toString()
}

export const ids = {
  website: (site: string) => `${site}/#website`,
  organization: (site: string) => `${site}/#organization`,
  product: (site: string) => `${site}/#product`,
}

export function organizationNode(ctx: JsonLdContext): Record<string, unknown> {
  const { company, siteUrl } = ctx
  const node: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': ids.organization(siteUrl),
    name: company.legalName,
    legalName: company.legalName,
    alternateName: company.brandName,
    url: absoluteUrl(siteUrl, '/about/'),
    description: company.introduction,
    logo: { '@type': 'ImageObject', url: ctx.logo.url, width: ctx.logo.width, height: ctx.logo.height },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'CN',
      addressRegion: company.addressRegion,
      addressLocality: company.addressLocality,
    },
  }
  if (company.display.foundedAt) {
    node.foundingDate = company.foundedAt
  }
  if (company.display.creditCode) {
    node.taxID = company.unifiedSocialCreditCode
  }
  const contacts = company.contacts.filter((c) => c.verified)
  if (contacts.length) {
    node.contactPoint = contacts.map((c) => ({
      '@type': 'ContactPoint',
      contactType: c.id === 'business' ? 'sales' : 'customer support',
      name: c.label,
      email: c.value,
      availableLanguage: ['zh-CN'],
    }))
  }
  return node
}

export function productNode(ctx: JsonLdContext, screenshots: readonly string[] = []): Record<string, unknown> {
  const { product, releases, siteUrl, company } = ctx
  const node: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    '@id': ids.product(siteUrl),
    name: product.name,
    description: product.definition,
    applicationCategory: 'SocialNetworkingApplication',
    url: absoluteUrl(siteUrl, '/'),
    inLanguage: 'zh-CN',
    image: ctx.logo.url,
  }
  const os = availablePlatforms(releases)
  if (os.length) {
    node.operatingSystem = os.join(', ')
  }
  if (screenshots.length) {
    node.screenshot = screenshots
  }
  if (company.operator.effective) {
    node.publisher = { '@id': ids.organization(siteUrl) }
  }
  return node
}

export function buildJsonLd(ctx: JsonLdContext, page: PageSeo, screenshots: readonly string[] = []): Record<string, unknown> {
  const { siteUrl } = ctx
  const pageUrl = absoluteUrl(siteUrl, page.path)
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebSite',
      '@id': ids.website(siteUrl),
      url: absoluteUrl(siteUrl, '/'),
      name: ctx.siteName,
      alternateName: `${ctx.siteName}官网`,
      inLanguage: 'zh-CN',
      publisher: { '@id': ids.organization(siteUrl) },
    },
    organizationNode(ctx),
    productNode(ctx, screenshots),
  ]

  const types: string[] = [page.pageType ?? 'WebPage']
  if (page.faqs?.length) {
    types.push('FAQPage')
  }
  const about: Record<string, unknown>[] = [
    { '@id': page.about === 'organization' ? ids.organization(siteUrl) : ids.product(siteUrl) },
  ]
  for (const game of page.videoGames ?? []) {
    about.push({ '@type': 'VideoGame', name: game.name, alternateName: game.alternateName, sameAs: game.sameAs })
  }
  const webPage: Record<string, unknown> = {
    '@type': types.length === 1 ? types[0] : types,
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: page.title,
    description: page.description,
    inLanguage: 'zh-CN',
    isPartOf: { '@id': ids.website(siteUrl) },
    about: about.length === 1 ? about[0] : about,
    dateModified: page.dateModified,
    primaryImageOfPage: { '@type': 'ImageObject', url: absoluteUrl(siteUrl, page.ogImage) },
  }
  if (page.breadcrumbs.length) {
    webPage.breadcrumb = { '@id': `${pageUrl}#breadcrumb` }
  }
  if (page.faqs?.length) {
    webPage.mainEntity = page.faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: plainText(f.answer) },
    }))
  }
  graph.push(webPage)

  if (page.breadcrumbs.length) {
    const crumbs: Crumb[] = [{ name: '首页', path: '/' }, ...page.breadcrumbs]
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${pageUrl}#breadcrumb`,
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: absoluteUrl(siteUrl, c.path),
      })),
    })
  }
  return { '@context': 'https://schema.org', '@graph': graph }
}

/**
 * JSON-LD 放进 <script type="application/ld+json">：把 < 转义，防止正文里的字符串提前结束脚本块。
 * 这是数据块，浏览器不会执行，CSP 不需要为它放开内联脚本。
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
}
