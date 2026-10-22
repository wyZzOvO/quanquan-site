/**
 * 静态页面的标题、描述、规范路径与实质更新日期（需求文档 15.1、16.1）。
 * 页面、站点地图、llms.txt 共用这份清单；改了页面内容要同步改 updatedAt（只在实质更新时改）。
 */
import type { SiteContent } from './loadContent.ts'
import type { GamePage } from './schema.ts'

export interface StaticPage {
  key: 'home' | 'features' | 'games' | 'download' | 'about' | 'support'
  path: string
  /** 导航与面包屑里的名字 */
  name: string
  title: string
  description: string
  keywords: string[]
  ogImage: string
  ogImageAlt: string
  updatedAt: string
}

export function staticPages(content: SiteContent): Record<StaticPage['key'], StaticPage> {
  const { company } = content
  return {
    home: {
      key: 'home',
      path: '/',
      name: '半拍',
      title: '半拍官网 - 主机与 PC 游戏找搭子、找队和语音开黑',
      description:
        '半拍提供游戏找搭子、队伍列表和语音开黑入口，覆盖双影奇境、星露谷物语、泰拉瑞亚、怪物猎人等游戏。查看玩法场景、下载方式与网页版入口。',
      keywords: ['半拍', '找游戏搭子', '游戏找队', '语音开黑', '开黑组队'],
      ogImage: '/og/home.jpg',
      ogImageAlt: '半拍：找到同频的游戏搭子',
      updatedAt: '2026-10-19',
    },
    features: {
      key: 'features',
      path: '/features/',
      name: '功能',
      title: '半拍功能 - 看队伍、找搭子、语音开黑与继续约玩',
      description:
        '在半拍先选想玩的游戏，再查看队伍和玩家的游玩条件；确定时间与约定后，在 App 或网页版里完成沟通和组队，用队伍语音一起开黑。',
      keywords: ['半拍功能', '找队', '找搭子', '队伍语音', '固定队'],
      ogImage: '/og/features.jpg',
      ogImageAlt: '半拍功能：看队伍、找搭子、语音开黑、继续约玩',
      updatedAt: '2026-10-19',
    },
    games: {
      key: 'games',
      path: '/games/',
      name: '游戏',
      title: '半拍支持的游戏 - 双影奇境、星露谷物语、泰拉瑞亚、怪物猎人找搭子',
      description:
        '查看半拍当前公开支持的游戏场景：双影奇境双人同行、星露谷物语长期农场、泰拉瑞亚开荒建世界、怪物猎人分作品找猎友，以及各自开放的平台。',
      keywords: ['双影奇境找搭子', '星露谷物语联机', '泰拉瑞亚组队', '怪物猎人找猎友'],
      ogImage: '/og/games.jpg',
      ogImageAlt: '半拍支持的游戏场景',
      updatedAt: '2026-10-19',
    },
    download: {
      key: 'download',
      path: '/download/',
      name: '下载',
      title: '半拍官方下载与获取方式',
      description:
        '查看半拍 iPhone 与 Android 版的当前获取方式、版本和运营者信息，或直接进入网页版。只从这里列出的官方渠道获取半拍。',
      keywords: ['半拍下载', '半拍官方下载', '半拍网页版'],
      ogImage: '/og/download.jpg',
      ogImageAlt: '半拍官方下载与获取方式',
      updatedAt: '2026-10-19',
    },
    about: {
      key: 'about',
      path: '/about/',
      name: '关于半亩晴空',
      title: company.operator.effective
        ? `关于半亩晴空 - 半拍运营公司`
        : `关于半亩晴空 - ${company.legalName}`,
      description: `${company.legalName}（半亩晴空）是半拍背后的公司，关注玩家之间的连接。了解公司信息、与半拍的关系和联系方式。`,
      keywords: ['半亩晴空', company.legalName, '半拍'],
      ogImage: '/og/about.jpg',
      ogImageAlt: `关于半亩晴空：${company.legalName}`,
      updatedAt: '2026-10-19',
    },
    support: {
      key: 'support',
      path: '/support/',
      name: '支持',
      title: '半拍帮助与支持',
      description:
        '半拍常见问题：支持哪些游戏、怎样下载和进入网页版、怎样找队、语音权限、跨平台、收费说明、投诉举报、个人信息请求与账号注销。',
      keywords: ['半拍帮助', '半拍客服', '半拍注销', '半拍举报'],
      ogImage: '/og/support.jpg',
      ogImageAlt: '半拍帮助与支持',
      updatedAt: '2026-10-19',
    },
  }
}

export function gamePath(game: GamePage): string {
  return `/games/${game.slug}/`
}

export function gameOgImage(game: GamePage): string {
  return `/og/game-${game.slug}.jpg`
}

export interface SitemapEntry {
  path: string
  lastmod: string
}

/** 站点地图只列正式、可收录、返回 200 的规范页面 */
export function sitemapEntries(content: SiteContent): SitemapEntry[] {
  const pages = Object.values(staticPages(content)).map((p) => ({ path: p.path, lastmod: p.updatedAt }))
  const games = content.publishedGames.map((g) => ({ path: gamePath(g), lastmod: g.updatedAt }))
  return [...pages, ...games]
}
