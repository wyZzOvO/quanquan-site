/**
 * robots.txt（需求文档 16.1、18.1、25.3）。正式站：允许搜索类爬虫读取公开页面，接口与后台不抓取；
 * 训练用途的爬虫按 site.yaml 的 crawlers.allowTraining 单独管理。单独列出的爬虫组不会继承 * 组，所以每组重复同样的规则。
 * 分享（/s/）、推广（/r/、/t/）落地页与网页版不在这里屏蔽：它们自带 noindex，屏蔽了反而读不到 noindex。
 * 预览与开发环境整站禁止抓取。robots 不是权限控制，保密依靠鉴权。
 */
import type { APIRoute } from 'astro'
import { content, siteEnv } from '../lib/content.ts'
import { buildRobots } from '../lib/robots.ts'

export const GET: APIRoute = () =>
  new Response(buildRobots({ siteUrl: siteEnv.siteUrl, indexable: siteEnv.indexable, allowTraining: content.settings.crawlers.allowTraining }), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
