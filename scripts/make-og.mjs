#!/usr/bin/env node
/**
 * 生成各页面的分享图 public/og/*.jpg（1200 × 630）：用本机 Chrome 渲染 HTML 后截图，中文用系统字体。
 * 游戏页的插画取自已构建的页面（dist/games/<slug>/），所以先 astro build 再运行本脚本：
 *   npx astro build && node scripts/make-og.mjs && npm run build
 * 改了页面标题、游戏插画或截图后重新生成；生成的图片提交到仓库。
 */
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'
import { parse } from 'node-html-parser'
import { staticPages, gamePath } from '../src/lib/pages.ts'
import { loadSiteContent, ROOT } from './lib/content-node.mjs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = path.join(ROOT, 'public/og')
const content = await loadSiteContent()
const pages = staticPages(content)

const dataUri = async (file, type) => `data:${type};base64,${(await readFile(file)).toString('base64')}`
const mark = await dataUri(path.join(ROOT, 'src/assets/brand/mark.png'), 'image/png')
const shot = async (name) =>
  `data:image/jpeg;base64,${(await sharp(path.join(ROOT, `src/assets/screens/${name}.png`)).resize({ width: 640 }).jpeg({ quality: 88 }).toBuffer()).toString('base64')}`

const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

function frame({ eyebrow, title, subtitle, visual }) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB',sans-serif;color:#16161e;
    background:radial-gradient(60% 70% at 82% 70%,rgba(123,97,255,.22),transparent 70%),radial-gradient(30% 40% at 95% 20%,rgba(245,213,71,.18),transparent 70%),linear-gradient(180deg,#fff,#f6f4ff)}
  .wrap{display:flex;height:100%;padding:0 0 0 84px;align-items:center;gap:40px}
  .text{flex:1;min-width:0}
  .brand{display:flex;align-items:center;gap:12px;font-size:30px;font-weight:600}
  .brand img{height:40px}
  .eyebrow{margin-top:44px;color:#654af0;font-size:28px;font-weight:600}
  h1{margin-top:12px;font-size:64px;line-height:1.14;font-weight:700;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
  p.sub{margin-top:22px;color:#62626a;font-size:28px;line-height:1.5;word-break:keep-all;overflow-wrap:anywhere}
  .foot{position:absolute;left:84px;bottom:44px;color:#62626a;font-size:22px}
  .visual{width:470px;height:100%;position:relative;flex:none}
  .phone{position:absolute;left:60px;top:70px;width:330px;padding:11px;border-radius:54px;background:linear-gradient(150deg,#34333b,#16151b 55%,#2a2930);box-shadow:0 40px 80px -24px rgba(40,26,110,.45)}
  .screen{border-radius:44px;overflow:hidden;background:#fff;height:640px}
  .screen img{width:100%;display:block}
  .art{position:absolute;right:56px;top:95px;width:440px;height:440px;border-radius:40px;overflow:hidden;box-shadow:0 30px 70px -24px rgba(22,22,30,.35)}
  .art svg{width:100%;height:100%;display:block}
  </style></head><body><div class="wrap"><div class="text">
  <div class="brand"><img src="${mark}" alt="">玉米圈</div>
  ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : '<div style="height:44px"></div>'}
  <h1>${title}</h1>
  <p class="sub">${esc(subtitle)}</p>
  </div><div class="visual">${visual}</div></div>
  <div class="foot">${esc(content.company.legalName)}</div>
  </body></html>`
}

const phone = (src) => `<div class="phone"><div class="screen"><img src="${src}" alt=""></div></div>`

async function gameArt(game) {
  const html = await readFile(path.join(ROOT, 'dist', gamePath(game).slice(1), 'index.html'), 'utf8')
  const svg = parse(html).querySelector('.hero-art svg')
  if (!svg) {
    throw new Error(`没有在 dist 里找到 ${game.slug} 的插画，请先 astro build`)
  }
  return `<div class="art">${svg.outerHTML}</div>`
}

const jobs = [
  { file: 'home', eyebrow: '', title: '找到同频的<br>游戏搭子', subtitle: content.product.shortDescription, visual: phone(await shot('team-list')) },
  { file: 'features', eyebrow: '功能', title: '从找到人，<br>到一起开黑', subtitle: '看队伍 · 找搭子 · 语音开黑 · 继续约玩', visual: phone(await shot('find')) },
  {
    file: 'games',
    eyebrow: '游戏',
    title: '这些游戏，<br>在玉米圈找搭子',
    subtitle: content.publishedGames.map((g) => g.displayName).join(' · '),
    visual: phone(await shot('campaigns-stardew')),
  },
  { file: 'download', eyebrow: '下载', title: '获取玉米圈', subtitle: 'iPhone · Android · 网页版', visual: phone(await shot('team-list')) },
  { file: 'about', eyebrow: '关于我们', title: '关于半亩晴空', subtitle: content.company.relation, visual: phone(await shot('squads')) },
  { file: 'support', eyebrow: '支持', title: '玉米圈<br>帮助与支持', subtitle: '常见问题 · 投诉举报 · 个人信息请求', visual: phone(await shot('party-detail')) },
]
for (const game of content.publishedGames) {
  jobs.push({
    file: `game-${game.slug}`,
    eyebrow: `${game.displayName} · ${game.englishName}`,
    // 标题里的"|"是建议换行处（见 links.ts withBreaks）
    title: game.h1.split('|').map(esc).join('<br>'),
    subtitle: game.card.summary,
    visual: await gameArt(game),
  })
}

// 与 pages.ts 里登记的 OG 路径保持一致
const expected = new Set([...Object.values(pages).map((p) => p.ogImage), ...content.publishedGames.map((g) => `/og/game-${g.slug}.jpg`)])
for (const job of jobs) {
  if (!expected.has(`/og/${job.file}.jpg`)) {
    throw new Error(`pages.ts 里没有 /og/${job.file}.jpg`)
  }
}

await mkdir(OUT, { recursive: true })
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1200, height: 630, deviceScaleFactor: 1 } })
try {
  const page = await browser.newPage()
  for (const job of jobs) {
    await page.setContent(frame(job), { waitUntil: 'load' })
    const png = await page.screenshot({ type: 'png' })
    const info = await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(OUT, `${job.file}.jpg`))
    console.log(`og/${job.file}.jpg  ${(info.size / 1024).toFixed(0)} KB`)
  }
} finally {
  await browser.close()
}
