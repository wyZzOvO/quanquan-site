import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildJsonLd, serializeJsonLd, type JsonLdContext, type PageSeo } from '../src/lib/seo.ts'
import { buildRobots } from '../src/lib/robots.ts'
import { buildSitemap } from '../src/lib/sitemap.ts'
import { sitemapEntries, staticPages } from '../src/lib/pages.ts'
import { normalizeSiteUrl, resolveSiteEnv } from '../src/lib/env.ts'
import { load } from './helpers.ts'

const SITE = 'https://www.monster-ovo.cn'

function ctx(effective: boolean): JsonLdContext {
  const c = load()
  return {
    siteUrl: SITE,
    siteName: '半拍',
    company: { ...c.company, operator: { ...c.company.operator, effective } },
    product: c.product,
    releases: c.releases,
    logo: { url: `${SITE}/icon-512.png`, width: 512, height: 512 },
  }
}

const page: PageSeo = {
  path: '/support/',
  title: '半拍帮助与支持',
  description: '常见问题',
  ogImage: '/og/support.jpg',
  ogImageAlt: '支持',
  breadcrumbs: [{ name: '支持', path: '/support/' }],
  dateModified: '2026-10-19',
  faqs: [{ question: '半拍是什么？', answer: '见[功能](/features/)。' }],
}

function nodes(data: Record<string, unknown>) {
  return data['@graph'] as Record<string, any>[]
}

test('组织、网站、产品、页面通过稳定 @id 关联', () => {
  const graph = nodes(buildJsonLd(ctx(false), page))
  const org = graph.find((n) => n['@type'] === 'Organization')!
  assert.equal(org['@id'], `${SITE}/#organization`)
  assert.equal(org.name, '长沙半亩晴空信息科技有限公司')
  assert.equal(org.alternateName, '半亩晴空')
  const web = graph.find((n) => n['@type'] === 'WebSite')!
  assert.deepEqual(web.publisher, { '@id': `${SITE}/#organization` })
  const p = graph.find((n) => Array.isArray(n['@type']) && n['@type'].includes('FAQPage'))!
  assert.equal(p.url, `${SITE}/support/`)
  assert.equal(p.mainEntity[0].acceptedAnswer.text, '见功能。')
  const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList')!
  assert.deepEqual(
    crumbs.itemListElement.map((i: any) => i.item),
    [`${SITE}/`, `${SITE}/support/`],
  )
})

test('公司成为生效运营主体之前，不输出产品的 publisher', () => {
  const before = nodes(buildJsonLd(ctx(false), page)).find((n) => n['@type'] === 'SoftwareApplication')!
  assert.equal(before.publisher, undefined)
  const after = nodes(buildJsonLd(ctx(true), page)).find((n) => n['@type'] === 'SoftwareApplication')!
  assert.deepEqual(after.publisher, { '@id': `${SITE}/#organization` })
})

test('没有真实依据的字段一律不输出', () => {
  const text = JSON.stringify(buildJsonLd(ctx(true), page))
  for (const key of ['aggregateRating', 'review', 'offers', 'ratingValue', 'downloadCount', 'award']) {
    assert.equal(text.includes(`"${key}"`), false, key)
  }
})

test('JSON-LD 序列化时转义 <，不会提前结束脚本块', () => {
  const out = serializeJsonLd({ a: '</script><script>alert(1)</script>' })
  assert.equal(out.includes('</script>'), false)
  assert.deepEqual(JSON.parse(out), { a: '</script><script>alert(1)</script>' })
})

test('robots：预览整站禁止；正式站允许搜索、限制接口，训练爬虫单独管理', () => {
  assert.match(buildRobots({ siteUrl: SITE, indexable: false, allowTraining: false }), /User-agent: \*\nDisallow: \/\n/)
  const prod = buildRobots({ siteUrl: SITE, indexable: true, allowTraining: false })
  assert.match(prod, /User-agent: \*\nAllow: \/\nDisallow: \/api\//)
  assert.match(prod, /User-agent: OAI-SearchBot[\s\S]*?Allow: \/\nDisallow: \/api\//)
  assert.match(prod, /User-agent: GPTBot[\s\S]*?Disallow: \/\n/)
  assert.ok(prod.includes(`Sitemap: ${SITE}/sitemap.xml`))
  // 分享与推广落地页靠页面自己的 noindex，不在 robots 里屏蔽
  assert.equal(/Disallow: \/(s|r|t)\//.test(prod), false)
  const training = buildRobots({ siteUrl: SITE, indexable: true, allowTraining: true })
  assert.match(training, /User-agent: GPTBot[\s\S]*?Allow: \/\nDisallow: \/api\//)
})

test('站点地图只列可收录页面，lastmod 用内容日期', () => {
  const c = load()
  const entries = sitemapEntries(c)
  const xml = buildSitemap(SITE, entries)
  assert.equal((xml.match(/<url>/g) ?? []).length, Object.keys(staticPages(c)).length + c.publishedGames.length)
  assert.ok(xml.includes(`<loc>${SITE}/games/monster-hunter/</loc>`))
  assert.equal(xml.includes('404'), false)
  assert.ok([...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].every((m) => m[1] === '2026-10-19'))
})

test('站点地址：只接受 https 根地址；正式构建不能用本机地址', () => {
  assert.equal(normalizeSiteUrl('https://www.monster-ovo.cn/'), SITE)
  assert.throws(() => normalizeSiteUrl('http://www.monster-ovo.cn'))
  assert.throws(() => normalizeSiteUrl('https://www.monster-ovo.cn/site/'))
  assert.equal(resolveSiteEnv({}).name, 'development')
  assert.equal(resolveSiteEnv({ SITE_ENV: 'production' }).indexable, true)
  assert.throws(() => resolveSiteEnv({ SITE_ENV: 'production', SITE_URL: 'http://localhost:4321' }))
  assert.throws(() => resolveSiteEnv({ SITE_ENV: 'staging' }))
})
