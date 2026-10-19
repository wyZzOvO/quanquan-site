/**
 * 链接与文本工具：内容里的链接只允许站内路径或白名单域名（需求文档 14.3：拒绝 javascript、data、协议相对地址与开放重定向）。
 * 正文支持一种最小标记：[文字](链接)，其余一律按纯文本转义。
 */

/** 正文、来源、官方站点允许的外部域名（游戏与平台官方、备案查询） */
export const CONTENT_LINK_HOSTS: ReadonlySet<string> = new Set([
  // 备案与企业信息查询
  'beian.miit.gov.cn',
  'beian.mps.gov.cn',
  'www.gsxt.gov.cn',
  // 游戏官方
  'www.ea.com',
  'help.ea.com',
  'www.hazelight.se',
  'www.stardewvalley.net',
  'stardewvalley.net',
  'terraria.org',
  'www.terraria.org',
  'forums.terraria.org',
  'www.monsterhunter.com',
  'monsterhunter.com',
  'www.capcom-games.com',
  'info.monsterhunter.com',
  // 平台官方
  'store.steampowered.com',
  'help.steampowered.com',
  'store.playstation.com',
  'www.playstation.com',
  'www.xbox.com',
  'support.xbox.com',
  'www.nintendo.com',
  'www.nintendo.com.hk',
  'www.nintendo.co.jp',
  // 应用分发
  'apps.apple.com',
  'testflight.apple.com',
])

const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9\-._~/%#?=&]*$/

/** 站内路径：以单个 / 开头，不含反斜杠、空白和协议 */
export function isInternalPath(href: string): boolean {
  return SAFE_PATH.test(href) && !href.includes('\\')
}

/** https 地址且域名在白名单里；不接受用户名密码、非 443 端口 */
export function isAllowedHttpsUrl(href: string, hosts: ReadonlySet<string> | readonly string[]): boolean {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return false
  }
  const allowed = hosts instanceof Set ? hosts : new Set(hosts as readonly string[])
  return url.protocol === 'https:' && !url.username && !url.password && !url.port && allowed.has(url.hostname)
}

const MAILTO = /^mailto:[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

export function isSafeHref(href: string, hosts: ReadonlySet<string> | readonly string[] = CONTENT_LINK_HOSTS): boolean {
  return isInternalPath(href) || isAllowedHttpsUrl(href, hosts) || MAILTO.test(href)
}

export function hostOf(href: string): string | null {
  try {
    return new URL(href).hostname
  } catch {
    return null
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g

/** 正文里的所有链接（校验用） */
export function extractLinks(source: string): { label: string; href: string }[] {
  return [...source.matchAll(LINK)].map((m) => ({ label: m[1] ?? '', href: m[2] ?? '' }))
}

/**
 * 一段正文转成 HTML：先整体转义，再把 [文字](链接) 换成 <a>。链接不安全时抛错（构建失败），而不是悄悄丢掉。
 */
export function renderInline(source: string, hosts: ReadonlySet<string> | readonly string[] = CONTENT_LINK_HOSTS): string {
  let out = ''
  let last = 0
  for (const m of source.matchAll(LINK)) {
    const [whole, label = '', link = ''] = m
    if (!isSafeHref(link, hosts)) {
      throw new Error(`正文里有不允许的链接：${link}`)
    }
    out += escapeHtml(source.slice(last, m.index))
    out += `<a href="${escapeHtml(link)}">${escapeHtml(label)}</a>`
    last = (m.index ?? 0) + whole.length
  }
  return out + escapeHtml(source.slice(last))
}

/** 去掉标记的纯文本（结构化数据、llms.txt、meta 描述用） */
export function plainText(source: string): string {
  return source.replace(LINK, '$1').replace(/\s*\n\s*\n\s*/g, '\n').trim()
}

/** 按空行分段 */
export function paragraphs(source: string): string[] {
  return source
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, '').trim())
    .filter(Boolean)
}

/**
 * 标题里的"|"是建议换行的位置：页面上渲染成 <wbr>（配合 word-break: keep-all，长标题只在这里或标点处换行），
 * 标题文字、结构化数据里去掉。
 */
export function withBreaks(source: string): string {
  return source
    .split('|')
    .map((part) => escapeHtml(part))
    .join('<wbr>')
}

export function withoutBreaks(source: string): string {
  return source.replaceAll('|', '')
}
