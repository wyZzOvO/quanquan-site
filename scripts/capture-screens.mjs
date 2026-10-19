#!/usr/bin/env node
/**
 * 用网页版的本地演示模式（假后端、演示数据）截取产品界面，生成 src/assets/screens/*.png。
 * 截图只含演示账号与演示数据（需求文档 5.2、3.3），页面上统一标注"界面示意"。
 *
 * 用法：
 *   1. 在 ~/quanquan-web 启动演示模式：npm run dev -- --mode mock --strictPort（默认 http://localhost:5180）
 *   2. node scripts/capture-screens.mjs
 * 可选环境变量：WEB_MOCK_URL（默认 http://localhost:5180）、CHROME_PATH（默认本机 Google Chrome）
 *
 * 截图前会隐藏几类内容：演示数据里的"在等 N 人"等人数统计（避免被误解为真实在线人数）、
 * 内测中的 AI 入口、尚未上线的功能区块。截完后用 sharp 压缩，并把尺寸写到终端，便于更新 assets.yaml。
 */
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'src/assets/screens')
const BASE = (process.env.WEB_MOCK_URL || 'http://localhost:5180').replace(/\/+$/, '')
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/** 统一隐藏：人数统计、AI 内测入口、开发态浮层 */
const COMMON_HIDE_TEXT = [/在等\s*\d+\s*人/, /与你兼容的在等/]
const COMMON_CSS = `
  a[href$="/ai"], a[href*="/ai?"] { display: none !important; }
  * { caret-color: transparent !important; }
  ::-webkit-scrollbar { display: none; }
`

/** @type {{ name: string, url: string, css?: string, hideText?: RegExp[], scrollTo?: string, wait?: string }[]} */
const SHOTS = [
  {
    name: 'team-list',
    url: '/web/tonight',
    // 只留找队列表：隐藏待办提示、固定队语音、我的队伍
    css: '.page > .notice, .page > .squads, .page > .mine { display: none !important; }',
    wait: '.grid',
  },
  {
    name: 'party-detail',
    url: '/web/parties/101',
    hideText: [/开局前核对/],
    wait: '.page',
  },
  {
    name: 'find',
    url: '/web/find?game=mhwilds',
    wait: '.page',
  },
  {
    name: 'campaigns-stardew',
    url: '/web/campaigns?game=stardew_valley',
    wait: '.page',
  },
  {
    name: 'campaigns-terraria',
    url: '/web/campaigns?game=terraria',
    wait: '.page',
  },
  {
    name: 'game-card',
    url: '/web/me/games/1',
    wait: '.page',
  },
  {
    name: 'campaign-new-terraria',
    url: '/web/campaigns/new?game=terraria',
    wait: '.page',
  },
  {
    name: 'squads',
    url: '/web/squads',
    wait: '.page',
  },
]

async function login(page) {
  await page.goto(`${BASE}/web/login`, { waitUntil: 'networkidle0' })
  const phone = await page.waitForSelector('input[placeholder*="手机号"]')
  await phone.type('13800000000')
  await page.click('input[type="checkbox"]')
  await clickByText(page, 'button', /获取验证码/)
  const code = await page.waitForSelector('input[placeholder*="验证码"]')
  await code.type('123456')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => !location.pathname.endsWith('/login'), { timeout: 15000 })
}

async function clickByText(page, selector, pattern) {
  const handles = await page.$$(selector)
  for (const h of handles) {
    const text = await h.evaluate((el) => el.textContent ?? '')
    if (pattern.test(text)) {
      await h.click()
      return
    }
  }
  throw new Error(`找不到按钮：${pattern}`)
}

/**
 * 按文字隐藏：block = true 时隐藏所在的整块（.card / section），否则只隐藏文字所在的那一行。
 * "自己的文字"只算直接文本与行内标签，避免命中外层容器。
 */
async function hideByText(page, patterns, block) {
  await page.evaluate(
    (sources, wholeBlock) => {
      const regs = sources.map((s) => new RegExp(s))
      const candidates = document.querySelectorAll('section, .card, .notice, p, div, li, h2, h3')
      for (const el of candidates) {
        const own = [...el.childNodes]
          .filter((n) => n.nodeType === Node.TEXT_NODE || (n instanceof HTMLElement && /^(H\d|SPAN|STRONG|B|EM|I)$/.test(n.tagName)))
          .map((n) => n.textContent ?? '')
          .join('')
        if (regs.some((r) => r.test(own))) {
          const target = wholeBlock ? (el.closest('.card, section') ?? el) : el
          target.style.setProperty('display', 'none', 'important')
        }
      }
    },
    patterns.map((p) => p.source),
    block,
  )
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    // 宽 430（6.7 英寸 iPhone 的逻辑宽度；网页版在 390 宽时找队卡片会被右边裁掉一点），
    // 高 878 = 932 减去 54 的状态栏：官网的手机外框会在截图上方补一条自制状态栏
    defaultViewport: { width: 430, height: 878, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    args: ['--hide-scrollbars', '--lang=zh-CN'],
  })
  try {
    const page = await browser.newPage()
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }])
    await login(page)
    for (const shot of SHOTS) {
      await page.goto(`${BASE}${shot.url}`, { waitUntil: 'networkidle0' })
      if (shot.wait) {
        await page.waitForSelector(shot.wait, { timeout: 15000 })
      }
      await new Promise((r) => setTimeout(r, 900))
      await page.addStyleTag({ content: COMMON_CSS + (shot.css ?? '') })
      await hideByText(page, COMMON_HIDE_TEXT, false)
      if (shot.hideText) {
        await hideByText(page, shot.hideText, true)
      }
      await page.evaluate(() => window.scrollTo(0, 0))
      await new Promise((r) => setTimeout(r, 400))
      const raw = await page.screenshot({ type: 'png' })
      const file = path.join(OUT, `${shot.name}.png`)
      const info = await sharp(raw).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(file)
      console.log(`${shot.name}.png  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} KB`)
    }
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
