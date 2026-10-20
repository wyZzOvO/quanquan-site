import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filingReleaseChecks, footerFilings, ICP_QUERY_URL, psbQueryUrl } from '../src/lib/filings.ts'
import { CONTENT_LINK_HOSTS, isAllowedHttpsUrl } from '../src/lib/links.ts'
import { load } from './helpers.ts'

const psb = { text: '湘公网安备43010202000000号', code: '43010202000000' }

test('页脚：ICP 在前、公安备案在后，公安备案号链接到平台的查询页', () => {
  const links = footerFilings({ icp: '湘ICP备2026012345号-1', psb })
  assert.deepEqual(
    links.map((l) => l.kind),
    ['icp', 'psb'],
  )
  assert.deepEqual(links[0], { kind: 'icp', text: '湘ICP备2026012345号-1', href: ICP_QUERY_URL })
  assert.deepEqual(links[1], {
    kind: 'psb',
    text: '湘公网安备43010202000000号',
    href: 'https://beian.mps.gov.cn/#/query/webSearch?code=43010202000000',
  })
  // 两个链接都是 https 白名单域名（产物检查会拒绝白名单外的外链）
  for (const l of links) {
    assert.ok(isAllowedHttpsUrl(l.href, CONTENT_LINK_HOSTS), l.href)
  }
  assert.equal(psbQueryUrl('43010202000000'), 'https://beian.mps.gov.cn/#/query/webSearch?code=43010202000000')
})

test('页脚：没有公安备案号时不展示，也不放占位', () => {
  assert.deepEqual(
    footerFilings({ icp: '京ICP备2024092535号-1', psb: null }).map((l) => l.kind),
    ['icp'],
  )
  assert.deepEqual(footerFilings({ icp: null, psb: null }), [])
})

test('页脚：当前内容（还没有公安备案号）只展示网站 ICP 备案号', () => {
  const { company } = load()
  const links = footerFilings(company.filings)
  assert.equal(links.filter((l) => l.kind === 'psb').length, company.filings.psb ? 1 : 0)
  assert.equal(links.filter((l) => l.kind === 'icp').length, company.filings.icp ? 1 : 0)
})

test('发布检查：缺公安联网备案号只提醒，不阻断发布', () => {
  const missing = filingReleaseChecks({ icp: '湘ICP备2026012345号-1', psb: null })
  assert.deepEqual(missing.failures, [])
  assert.ok(missing.notes.some((n) => n.includes('公安联网备案号未填写') && n.includes('30 日内')))

  const filled = filingReleaseChecks({ icp: '湘ICP备2026012345号-1', psb })
  assert.deepEqual(filled.failures, [])
  assert.deepEqual(filled.notes, [])
  assert.ok(filled.ok.some((n) => n.includes('湘公网安备43010202000000号')))
})

test('发布检查：网站 ICP 备案号缺失、填成 App 备案号或格式不对仍然阻断', () => {
  assert.equal(filingReleaseChecks({ icp: null, psb }).failures.length, 1)
  assert.ok(filingReleaseChecks({ icp: '京ICP备2024092535号-1A', psb }).failures[0]!.includes('不正确'))
  assert.ok(filingReleaseChecks({ icp: '备案中', psb }).failures[0]!.includes('不正确'))
  assert.deepEqual(filingReleaseChecks({ icp: '京ICP备2024092535号-1', psb }).failures, [])
})
