/**
 * 构建环境。astro.config.mjs、页面和 Node 脚本共用，只依赖传入的环境变量，便于测试。
 *
 * - production：正式站，允许搜索引擎收录；发布前还要通过 scripts/check-release.mjs（备案号、联系渠道等）。
 * - preview：预览环境（默认的 npm run build 就是它），页面带 noindex，robots.txt 禁止抓取。
 * - development：astro dev。
 */
export type SiteEnvName = 'production' | 'preview' | 'development'

export interface SiteEnv {
  name: SiteEnvName
  /** 站点根地址，不带结尾斜杠，例如 https://www.monster-ovo.cn */
  siteUrl: string
  /** 只有正式站允许收录 */
  indexable: boolean
}

export const DEFAULT_SITE_URL = 'https://www.monster-ovo.cn'

const NAMES: readonly SiteEnvName[] = ['production', 'preview', 'development']

export function resolveSiteEnv(vars: Readonly<Record<string, string | undefined>>): SiteEnv {
  const raw = (vars.SITE_ENV ?? '').trim()
  let name: SiteEnvName
  if ((NAMES as readonly string[]).includes(raw)) {
    name = raw as SiteEnvName
  } else if (raw) {
    throw new Error(`SITE_ENV 只能是 ${NAMES.join(' / ')}，收到：${raw}`)
  } else {
    name = vars.NODE_ENV === 'production' ? 'preview' : 'development'
  }
  const siteUrl = normalizeSiteUrl(vars.SITE_URL?.trim() || DEFAULT_SITE_URL)
  if (name === 'production' && isLocalHost(new URL(siteUrl).hostname)) {
    throw new Error(`正式构建不能使用本机地址作为 SITE_URL：${siteUrl}`)
  }
  return { name, siteUrl, indexable: name === 'production' }
}

/** 站点根地址：必须是 https（本机调试允许 http），不能带路径、参数 */
export function normalizeSiteUrl(input: string): string {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error(`SITE_URL 不是合法地址：${input}`)
  }
  const local = isLocalHost(url.hostname)
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error(`SITE_URL 必须是 https 地址：${input}`)
  }
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error(`SITE_URL 只能是站点根地址（不带路径、参数）：${input}`)
  }
  return url.origin
}

export function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost')
}
