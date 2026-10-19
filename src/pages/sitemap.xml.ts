/**
 * 站点地图（需求文档 16.1）：只列正式域名下返回 200、可收录的规范页面；lastmod 取内容的实质更新日期，
 * 不随每次构建改成当天。预览环境输出空地图。
 */
import type { APIRoute } from 'astro'
import { content, siteEnv } from '../lib/content.ts'
import { sitemapEntries } from '../lib/pages.ts'
import { buildSitemap } from '../lib/sitemap.ts'

export const GET: APIRoute = () =>
  new Response(buildSitemap(siteEnv.siteUrl, siteEnv.indexable ? sitemapEntries(content) : []), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
