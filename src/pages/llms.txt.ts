/**
 * llms.txt：给采用这一约定的系统用的公开导航（需求文档 18.2：不是收录通行证，Google 不会因此提高可见性）。
 * 内容全部来自与网页同一份配置，只有事实与链接，不写任何面向模型的指令。
 */
import type { APIRoute } from 'astro'
import { content, siteEnv, supportContact } from '../lib/content.ts'
import { gamePath, staticPages } from '../lib/pages.ts'
import { absoluteUrl } from '../lib/seo.ts'
import { STATUS_LABELS, platformSummaries } from '../lib/downloads.ts'
import { webEntryHref } from '../lib/entries.ts'
import { formatDateZh } from '../lib/format.ts'

export const GET: APIRoute = () => {
  const site = siteEnv.siteUrl
  const url = (path: string) => absoluteUrl(site, path)
  const { company, product, releases, publishedGames } = content
  const pages = staticPages(content)
  const web = webEntryHref(releases)

  const lines: string[] = [
    `# ${product.name}`,
    '',
    `> ${product.definition}`,
    '',
    `本文件列出${product.name}官网的主要页面与公开事实，内容与网页一致，更新于 ${formatDateZh(pages.home.updatedAt)}。`,
    '',
    '## 产品',
    `- [${product.name}官网首页](${url('/')})：${pages.home.description}`,
    `- [功能](${url(pages.features.path)})：${pages.features.description}`,
    `- [下载与获取](${url(pages.download.path)})：${pages.download.description}`,
    ...(web ? [`- [网页版](${url(web)})：${releases.web.note}`] : []),
    '',
    '## 游戏',
    `- [支持的游戏](${url(pages.games.path)})：${pages.games.description}`,
    ...publishedGames.map((g) => {
      const open = g.titles.filter((t) => t.supportStatus === 'open')
      const platforms =
        open.length === 1
          ? `当前开放平台：${open[0]!.openPlatforms.join('、')}`
          : `当前开放：${open.map((t) => `${t.name}（${t.openPlatforms.join('、')}）`).join('；')}`
      return `- [${g.displayName}](${url(gamePath(g))})：${g.seo.description}${platforms}。`
    }),
    '',
    '## 公司与支持',
    `- [关于半亩晴空](${url(pages.about.path)})：${pages.about.description}`,
    `- [帮助与支持](${url(pages.support.path)})：${pages.support.description}`,
    `- [隐私政策](${url('/legal/privacy-policy.html')})`,
    `- [用户服务协议](${url('/legal/user-agreement.html')})`,
    '',
    '## 公开事实',
    `- 产品名称：${product.name}`,
    `- 公司：${company.legalName}（公司品牌：${company.brandName}），成立于 ${formatDateZh(company.foundedAt)}，登记所在地 ${company.registeredRegion}`,
    `- 公司与产品的关系：${company.brandName}是公司品牌，${product.name}是产品品牌`,
    `- 运营主体：${
      company.operator.effective
        ? `${product.name}由${company.legalName}运营`
        : `正在变更为${company.legalName}，变更完成前以当前生效的《用户服务协议》和《隐私政策》为准`
    }`,
    ...platformSummaries(releases).map((s) => `- ${s.label}：${STATUS_LABELS[s.status]}`),
    `- 网页版：${web ? url(web) : '暂未开放'}`,
    `- 使用年龄：年满 ${product.minAge} 周岁`,
    `- 收费：${product.pricingNote}`,
    `- 联系邮箱：${supportContact.value}`,
    '',
  ]
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
