/**
 * Astro 侧的内容入口：构建时读取 src/content 下的全部 YAML / JSON 并校验（见 loadContent.ts），
 * 页面、站点地图、robots、llms.txt 都从这里取数，保证页面与结构化数据同源（FR06）。
 */
import { loadContent, type SiteContent } from './loadContent.ts'
import { resolveSiteEnv, type SiteEnv } from './env.ts'
import { openGameCodes } from './entries.ts'
import type { Faq } from './schema.ts'

const raw = import.meta.glob('../content/**/*.{yaml,json}', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

const files: Record<string, string> = {}
for (const [key, source] of Object.entries(raw)) {
  files[key.replace(/^\.\.\/content\//, '')] = source
}

export const content: SiteContent = loadContent(files)
export const siteEnv: SiteEnv = resolveSiteEnv(process.env)
export const gameCodeWhitelist: ReadonlySet<string> = openGameCodes(content.games)

export const supportContact = content.company.contacts.find((c) => c.id === 'support') ?? content.company.contacts[0]!
export const businessContact = content.company.contacts.find((c) => c.id === 'business') ?? supportContact

/** FAQ 是否显示：requires 对应的能力开放、网页版入口开放 */
export function faqVisible(faq: Faq): boolean {
  if (!faq.requires) {
    return true
  }
  if (faq.requires === 'web') {
    return content.releases.web.enabled
  }
  return (content.product.capabilities as Record<string, boolean>)[faq.requires] === true
}

/** 正文里的 {supportEmail} 换成用户支持邮箱（可点击） */
export function fillTokens(text: string): string {
  return text.replaceAll('{supportEmail}', `[${supportContact.value}](mailto:${supportContact.value})`)
}

export const visibleFaqs: Faq[] = content.faqs.filter(faqVisible).map((f) => ({ ...f, answer: fillTokens(f.answer) }))

export function gameBySlug(slug: string) {
  return content.publishedGames.find((g) => g.slug === slug)
}

/** 公司成立年份到构建年份 */
export function copyrightYears(): string {
  const start = Number(content.company.foundedAt.slice(0, 4))
  const now = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date()))
  return now > start ? `${start}–${now}` : String(start)
}
