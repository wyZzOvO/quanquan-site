import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ContentError } from '../src/lib/loadContent.ts'
import { contentFiles, load, releasesWith } from './helpers.ts'

function problemsOf(fn: () => unknown): string[] {
  try {
    fn()
  } catch (error) {
    if (error instanceof ContentError) {
      return error.problems
    }
    throw error
  }
  assert.fail('应当校验失败')
}

test('当前内容可以通过校验', () => {
  const c = load()
  assert.equal(c.company.legalName, '长沙半亩晴空信息科技有限公司')
  assert.deepEqual(
    c.publishedGames.map((g) => g.slug),
    ['split-fiction', 'stardew-valley', 'terraria', 'monster-hunter'],
  )
  // 已发布游戏的作品里只有崛起：曙光是规划中
  const planned = c.games.flatMap((g) => g.titles.filter((t) => t.supportStatus === 'planned').map((t) => t.code))
  assert.deepEqual(planned, ['mhrise'])
})

test('游戏 slug 必须与文件名一致、不能重复', () => {
  const files = contentFiles()
  const problems = problemsOf(() => load({ 'games/copy.yaml': files['games/terraria.yaml'] }))
  assert.ok(problems.some((p) => p.includes('slug（terraria）必须与文件名一致')))
  assert.ok(problems.some((p) => p.includes('游戏页 slug 重复')))
})

test('已开放的作品必须在后端游戏字典里', () => {
  const files = contentFiles()
  const broken = files['games/terraria.yaml']!.replace('  - code: terraria\n', '  - code: terraria_unknown\n')
  const problems = problemsOf(() => load({ 'games/terraria.yaml': broken }))
  assert.ok(problems.some((p) => p.includes('terraria_unknown 不在后端游戏字典里')))
})

test('available 渠道必须有白名单内的 https 地址、版本与日期', () => {
  const noUrl = releasesWith((r) => {
    r.channels[0].status = 'available'
  })
  let problems = problemsOf(() => load({ 'releases.json': noUrl }))
  assert.ok(problems.some((p) => p.includes('available 必须填写真实地址')))
  assert.ok(problems.some((p) => p.includes('available 必须填写 version 与 releasedAt')))

  const badHost = releasesWith((r) => {
    Object.assign(r.channels[0], { status: 'available', url: 'https://download.evil.cn/app.ipa', version: '1.0.0', releasedAt: '2026-10-19' })
  })
  problems = problemsOf(() => load({ 'releases.json': badHost }))
  assert.ok(problems.some((p) => p.includes('域名在 allowedHosts 里')))

  const http = releasesWith((r) => {
    Object.assign(r.channels[0], { status: 'available', url: 'http://apps.apple.com/cn/app/id1', version: '1.0.0', releasedAt: '2026-10-19' })
  })
  problems = problemsOf(() => load({ 'releases.json': http }))
  assert.ok(problems.some((p) => p.includes('必须是 https')))
})

test('未开放的渠道不能填地址，beta 必须写测试范围', () => {
  const leaked = releasesWith((r) => {
    r.channels[0].url = 'https://apps.apple.com/cn/app/id1'
  })
  assert.ok(problemsOf(() => load({ 'releases.json': leaked })).some((p) => p.includes('不应填写地址')))
  const beta = releasesWith((r) => {
    Object.assign(r.channels[0], { status: 'beta', kind: 'testflight', url: 'https://testflight.apple.com/join/abc' })
  })
  assert.ok(problemsOf(() => load({ 'releases.json': beta })).some((p) => p.includes('beta 必须写明测试范围')))
})

test('安装包必须提供大小与 SHA-256', () => {
  const apk = releasesWith((r) => {
    Object.assign(r.channels[1], {
      kind: 'apk',
      status: 'available',
      url: 'https://www.monster-ovo.cn/downloads/yumiquan.apk',
      version: '1.0.0',
      releasedAt: '2026-10-19',
    })
  })
  assert.ok(problemsOf(() => load({ 'releases.json': apk })).some((p) => p.includes('安装包必须提供 sizeBytes 与 sha256')))
})

test('网页版地址只能是同域 /web/ 或白名单 https', () => {
  const bad = releasesWith((r) => {
    r.web.url = 'javascript:alert(1)'
  })
  const problems = problemsOf(() => load({ 'releases.json': bad }))
  assert.ok(problems.some((p) => p.includes('网页版') || p.includes('链接只能是')))
})

test('App 备案号不能当作网站 ICP 备案号，格式错误也拦下', () => {
  const files = contentFiles()
  // 不管当前填的是什么，都替换 icp 这一行
  const withIcp = (value: string) => files['company.yaml']!.replace(/^ {2}icp: .*$/m, `  icp: ${value}`)
  assert.ok(problemsOf(() => load({ 'company.yaml': withIcp('京ICP备2024092535号-1A') })).some((p) => p.includes('是 App 备案号')))
  assert.ok(problemsOf(() => load({ 'company.yaml': withIcp('备案中') })).some((p) => p.includes('格式不对')))
  assert.equal(load({ 'company.yaml': withIcp('湘ICP备2026012345号-1') }).company.filings.icp, '湘ICP备2026012345号-1')
  assert.equal(load({ 'company.yaml': withIcp('null') }).company.filings.icp, null)
})

test('公安联网备案号：完整文字与编号都要填，格式正确、编号一致', () => {
  const files = contentFiles()
  // 不管当前填的是 null 还是多行的对象，都整体替换 psb 这一项（它是 filings 的最后一项）
  const withPsb = (block: string) => files['company.yaml']!.replace(/^ {2}psb:.*(?:\n {4}.*)*/m, block)
  const psb = (text: string, code: string) => withPsb(`  psb:\n    text: ${text}\n    code: ${code}`)
  const problems = (yaml: string) => problemsOf(() => load({ 'company.yaml': yaml }))

  assert.deepEqual(load({ 'company.yaml': psb('湘公网安备43010202000000号', '"43010202000000"') }).company.filings.psb, {
    text: '湘公网安备43010202000000号',
    code: '43010202000000',
  })
  // 平台写法里"备"与编号之间有一个空格的也接受，原样展示
  assert.equal(
    load({ 'company.yaml': psb('湘公网安备 43010202000000号', '"43010202000000"') }).company.filings.psb?.text,
    '湘公网安备 43010202000000号',
  )
  assert.equal(load({ 'company.yaml': withPsb('  psb: null') }).company.filings.psb, null)

  assert.ok(problems(psb('湘公网安备4301020200000号', '"4301020200000"')).some((p) => p.includes('公安联网备案号格式不对')))
  assert.ok(problems(psb('湘公网安备43010202000000号', '"4301020200000"')).some((p) => p.includes('应为 14 位数字')))
  assert.ok(problems(psb('湘公网安备43010202000000号', '"43010202000001"')).some((p) => p.includes('编号不一致')))
  // 编号不加引号会被 YAML 读成数字
  assert.ok(problems(psb('湘公网安备43010202000000号', '43010202000000')).some((p) => p.includes('要加引号')))
  assert.ok(problems(withPsb('  psb:\n    text: 湘公网安备43010202000000号')).some((p) => p.includes('缺少备案编号')))
  // 旧写法：只写一个字符串
  assert.ok(problems(withPsb('  psb: 湘公网安备43010202000000号')).some((p) => p.includes('text 与 code 两项')))
  // 多写的字段（拼写错误）也会被拒绝
  assert.ok(
    problems(withPsb('  psb:\n    text: 湘公网安备43010202000000号\n    code: "43010202000000"\n    url: https://beian.mps.gov.cn/')).some(
      (p) => p.includes('filings.psb'),
    ),
  )
})

test('示例域名、占位邮箱不能进入内容', () => {
  const files = contentFiles()
  const placeholder = files['company.yaml']!.replaceAll('wyzzovo@gmail.com', 'support@example.com')
  assert.ok(problemsOf(() => load({ 'company.yaml': placeholder })).some((p) => p.includes('占位内容')))
})

test('FAQ 里的链接只能是站内路径或白名单域名', () => {
  const files = contentFiles()
  const bad = files['faqs.yaml']!.replace('[下载页](/download/)', '[下载页](https://evil.example.cn/)')
  assert.ok(problemsOf(() => load({ 'faqs.yaml': bad })).some((p) => p.includes('链接不在白名单里')))
})

test('游戏页的截图必须登记在素材清单里', () => {
  const files = contentFiles()
  const bad = files['games/stardew-valley.yaml']!.replace('screen: campaigns-stardew', 'screen: not-registered')
  assert.ok(problemsOf(() => load({ 'games/stardew-valley.yaml': bad })).some((p) => p.includes('没有在 assets.yaml 登记')))
})

test('未知字段（拼写错误）会被拒绝', () => {
  const files = contentFiles()
  const typo = files['product.yaml']!.replace('minAge: 18', 'minAge: 18\nminage: 16')
  assert.ok(problemsOf(() => load({ 'product.yaml': typo })).some((p) => p.includes('minage')))
})

test('官方来源必须是白名单内的 https 地址', () => {
  const files = contentFiles()
  const bad = files['games/terraria.yaml']!.replace(
    'https://store.steampowered.com/app/1281930/',
    'https://terraria.fandom.com/wiki/TModLoader',
  )
  assert.ok(problemsOf(() => load({ 'games/terraria.yaml': bad })).some((p) => p.includes('官方来源域名不在白名单里')))
})
