import { test } from 'node:test'
import assert from 'node:assert/strict'
import { availablePlatforms, channelAction, hasAvailableChannel, platformSummaries, primaryCta } from '../src/lib/downloads.ts'
import { webEntryHref, webGameHref } from '../src/lib/entries.ts'
import type { DownloadChannel, Releases } from '../src/lib/schema.ts'
import { load } from './helpers.ts'

function channel(patch: Partial<DownloadChannel>): DownloadChannel {
  return {
    id: 'ios-app-store',
    platform: 'ios',
    kind: 'app_store',
    label: 'App Store',
    status: 'coming_soon',
    url: null,
    version: null,
    releasedAt: null,
    requirement: null,
    note: '即将上架',
    betaScope: null,
    apk: null,
    ...patch,
  }
}

function releases(channels: DownloadChannel[], webEnabled = true): Releases {
  return {
    schemaVersion: 1,
    product: '玉米圈',
    updatedAt: '2026-10-19',
    channels,
    web: { enabled: webEnabled, url: '/web/', note: '网页版' },
    allowedHosts: ['apps.apple.com'],
  }
}

test('没有已上线渠道时主按钮是"查看获取方式"，有了才是"下载玉米圈"', () => {
  const none = releases([channel({})])
  assert.equal(hasAvailableChannel(none), false)
  assert.deepEqual(primaryCta(none), { label: '查看获取方式', href: '/download/' })
  const live = releases([channel({ status: 'available', url: 'https://apps.apple.com/cn/app/id1', version: '1.0.0', releasedAt: '2026-10-19' })])
  assert.deepEqual(primaryCta(live), { label: '下载玉米圈', href: '/download/' })
})

test('只有 available / beta 的渠道给可点的按钮', () => {
  assert.deepEqual(channelAction(channel({})), { label: null, href: null })
  assert.deepEqual(channelAction(channel({ status: 'maintenance', note: '维护中，请先用网页版' })), { label: null, href: null })
  assert.equal(channelAction(channel({ status: 'available', url: 'https://apps.apple.com/cn/app/id1' })).label, '前往 App Store')
  assert.equal(
    channelAction(channel({ status: 'beta', kind: 'testflight', url: 'https://testflight.apple.com/join/x', betaScope: '内测' })).label,
    '加入 TestFlight 测试',
  )
  assert.equal(
    channelAction(channel({ platform: 'android', kind: 'apk', status: 'available', url: 'https://www.monster-ovo.cn/a.apk' })).label,
    '下载官方安装包',
  )
})

test('平台状态取该平台最好的渠道状态', () => {
  const r = releases([
    channel({ id: 'a', platform: 'android', kind: 'android_store', label: '应用宝', status: 'coming_soon' }),
    channel({ id: 'b', platform: 'android', kind: 'android_store', label: '华为', status: 'maintenance' }),
  ])
  const android = platformSummaries(r).find((s) => s.platform === 'android')!
  assert.equal(android.status, 'maintenance')
  assert.deepEqual(
    android.channels.map((c) => c.id),
    ['b', 'a'],
  )
  // 没有任何渠道的平台视为即将推出
  assert.equal(platformSummaries(r).find((s) => s.platform === 'ios')!.status, 'coming_soon')
})

test('结构化数据的系统只列已经能用的平台', () => {
  assert.deepEqual(availablePlatforms(releases([channel({})])), ['Web'])
  assert.deepEqual(availablePlatforms(releases([channel({})], false)), [])
})

test('网页版未开放时不给入口；游戏参数只接受白名单编码', () => {
  const content = load()
  const allowed = new Set(['terraria', 'mhwilds'])
  assert.equal(webEntryHref(content.releases), '/web/')
  assert.equal(webGameHref(content.releases, 'terraria', allowed), '/web/tonight?game=terraria')
  assert.throws(() => webGameHref(content.releases, 'cs2', allowed))
  assert.throws(() => webGameHref(content.releases, 'terraria"><script>', new Set(['terraria"><script>'])))
  const closed = { ...content.releases, web: { ...content.releases.web, enabled: false } }
  assert.equal(webEntryHref(closed), null)
  assert.equal(webGameHref(closed, 'terraria', allowed), null)
})
