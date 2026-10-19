/**
 * 下载状态模型（需求文档 8.1、FR04、FR13）：所有渠道从 releases.json 生成；
 * 只有 available 的渠道使用"下载 / 前往商店"，其他状态给出完整说明，不展示不可用的按钮。
 */
import type { ChannelStatus, DownloadChannel, Releases } from './schema.ts'

export type Platform = DownloadChannel['platform']

export const PLATFORM_LABELS: Record<Platform, string> = {
  ios: 'iPhone 与 iPad',
  android: 'Android 手机',
}

export const STATUS_LABELS: Record<ChannelStatus, string> = {
  available: '已上线',
  beta: '测试中',
  coming_soon: '即将推出',
  maintenance: '维护中',
  unsupported: '暂不支持',
}

/** 同一平台有多个渠道时，取最好的状态代表这个平台 */
const STATUS_RANK: Record<ChannelStatus, number> = {
  available: 0,
  beta: 1,
  maintenance: 2,
  coming_soon: 3,
  unsupported: 4,
}

export interface ChannelAction {
  /** 按钮文字；没有可点的操作时为 null */
  label: string | null
  href: string | null
}

export function channelAction(channel: DownloadChannel): ChannelAction {
  if (!channel.url) {
    return { label: null, href: null }
  }
  if (channel.status === 'available') {
    switch (channel.kind) {
      case 'app_store':
        return { label: '前往 App Store', href: channel.url }
      case 'android_store':
        return { label: `前往${channel.label}`, href: channel.url }
      case 'apk':
        return { label: '下载官方安装包', href: channel.url }
      case 'testflight':
        return { label: '通过 TestFlight 安装', href: channel.url }
    }
  }
  if (channel.status === 'beta') {
    return { label: channel.kind === 'testflight' ? '加入 TestFlight 测试' : '参加测试', href: channel.url }
  }
  return { label: null, href: null }
}

export interface PlatformSummary {
  platform: Platform
  label: string
  status: ChannelStatus
  channels: DownloadChannel[]
}

export function platformSummaries(releases: Releases): PlatformSummary[] {
  const platforms: Platform[] = ['ios', 'android']
  return platforms.map((platform) => {
    const channels = releases.channels
      .filter((c) => c.platform === platform)
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    const status: ChannelStatus = channels[0]?.status ?? 'coming_soon'
    return { platform, label: PLATFORM_LABELS[platform], status, channels }
  })
}

export function hasAvailableChannel(releases: Releases): boolean {
  return releases.channels.some((c) => c.status === 'available')
}

export interface PrimaryCta {
  label: string
  href: string
}

/** 首页与导航的主操作：有已上线渠道时"下载玉米圈"，否则"查看获取方式"（需求文档 5.3） */
export function primaryCta(releases: Releases): PrimaryCta {
  return hasAvailableChannel(releases)
    ? { label: '下载玉米圈', href: '/download/' }
    : { label: '查看获取方式', href: '/download/' }
}

/** 顶栏右侧的短按钮文字 */
export function navCtaLabel(releases: Releases): string {
  return hasAvailableChannel(releases) ? '下载' : '获取'
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** 结构化数据里的 operatingSystem：只列已经能用的平台 */
export function availablePlatforms(releases: Releases): string[] {
  const out: string[] = []
  if (releases.channels.some((c) => c.platform === 'ios' && c.status === 'available')) {
    out.push('iOS')
  }
  if (releases.channels.some((c) => c.platform === 'android' && c.status === 'available')) {
    out.push('Android')
  }
  if (releases.web.enabled) {
    out.push('Web')
  }
  return out
}
