/**
 * 进入现有产品的入口（需求文档 FR03、FR08）：网页版没有达到发布条件时一律返回 null，页面据此隐藏按钮；
 * 游戏页只把白名单里的游戏编码带给网页版（/web/tonight?game=…），不接受任意参数。
 */
import type { GamePage, Releases } from './schema.ts'

export function webEntryHref(releases: Releases): string | null {
  return releases.web.enabled ? releases.web.url : null
}

/** 已发布游戏页里已开放的作品编码 */
export function openGameCodes(games: readonly GamePage[]): Set<string> {
  return new Set(
    games
      .filter((g) => g.status === 'published')
      .flatMap((g) => g.titles.filter((t) => t.supportStatus === 'open').map((t) => t.code)),
  )
}

/** 带游戏的网页版找队入口；编码不在白名单里时抛错（构建失败） */
export function webGameHref(releases: Releases, code: string, allowed: ReadonlySet<string>): string | null {
  const base = webEntryHref(releases)
  if (!base) {
    return null
  }
  if (!allowed.has(code) || !/^[a-z0-9_]+$/.test(code)) {
    throw new Error(`游戏编码 ${code} 不在已开放的白名单里`)
  }
  const root = base.endsWith('/') ? base : `${base}/`
  return `${root}tonight?game=${encodeURIComponent(code)}`
}
