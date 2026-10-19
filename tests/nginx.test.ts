/**
 * nginx 片段的路由核对（需求文档 13.2、AC12）：官网的 location 只匹配官网自己的路径，
 * 不能匹配 /api/、/im、/web/、/legal/、/s/、/r/、/t/、/creator、/.well-known/ 等业务路由，也没有全站回落。
 * 这里用一个简化的 nginx location 匹配器（=、^~、前缀、~ 正则）检查 deploy/nginx/quanquan-site.conf。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT } from './helpers.ts'

interface Loc {
  modifier: '=' | '^~' | '~' | ''
  pattern: string
}

const conf = readFileSync(path.join(ROOT, 'deploy/nginx/quanquan-site.conf'), 'utf8')
const headers = readFileSync(path.join(ROOT, 'deploy/nginx/quanquan-site-headers.conf'), 'utf8')
const locations: Loc[] = [...conf.matchAll(/^location\s+(=|\^~|~)?\s*(\S+)\s*\{/gm)].map((m) => ({
  modifier: (m[1] ?? '') as Loc['modifier'],
  pattern: m[2]!,
}))

function matches(loc: Loc, uri: string): boolean {
  switch (loc.modifier) {
    case '=':
      return uri === loc.pattern
    case '~':
      return new RegExp(loc.pattern).test(uri)
    default:
      return uri.startsWith(loc.pattern)
  }
}

function siteHandles(uri: string): boolean {
  return locations.some((l) => matches(l, uri))
}

test('片段里没有全站回落（location / 前缀）', () => {
  assert.ok(locations.length >= 6)
  assert.equal(
    locations.some((l) => l.modifier === '' && l.pattern === '/'),
    false,
  )
  assert.equal(/try_files[^;]*\/index\.html;/.test(conf.replace('try_files /index.html =404;', '')), false)
})

test('业务路由不会被官网接管', () => {
  for (const uri of [
    '/api/health/ready',
    '/api/v1/web-auth/refresh',
    '/im',
    '/web/',
    '/web/tonight',
    '/web',
    '/legal/index.html',
    '/legal/privacy-policy.html',
    '/legal',
    '/s/abcdef',
    '/r/abc123',
    '/r/abc123/click',
    '/t/0123456789012345678901',
    '/creator',
    '/creator/',
    '/.well-known/apple-app-site-association',
    '/.well-known/assetlinks.json',
    '/v3/api-docs',
    '/some-new-backend-route',
  ]) {
    assert.equal(siteHandles(uri), false, `${uri} 不应由官网处理`)
  }
})

test('官网自己的页面与资源都有对应的 location', () => {
  for (const uri of [
    '/',
    '/features/',
    '/games/',
    '/games/terraria/',
    '/games/terraria',
    '/download/',
    '/about/',
    '/support/',
    '/_site/index.abc123.css',
    '/og/home.jpg',
    '/robots.txt',
    '/sitemap.xml',
    '/llms.txt',
    '/favicon.ico',
    '/404.html',
  ]) {
    assert.equal(siteHandles(uri), true, `${uri} 应由官网处理`)
  }
})

test('无结尾斜杠只对官网目录 301，带扩展名的路径不跳', () => {
  const redirect = locations.find((l) => conf.includes(`location ~ ${l.pattern} {\n    return 301`))!
  assert.ok(redirect)
  assert.equal(matches(redirect, '/games/terraria'), true)
  assert.equal(matches(redirect, '/games'), true)
  assert.equal(matches(redirect, '/games/terraria/'), false)
  assert.equal(matches(redirect, '/games/x.png'), false)
  assert.equal(matches(redirect, '/gamesx'), false)
})

test('官网页面的安全响应头：不放开内联脚本，禁用麦克风、摄像头、定位', () => {
  const csp = headers.match(/Content-Security-Policy "([^"]+)"/)?.[1] ?? ''
  assert.ok(csp.includes("script-src 'self'"))
  assert.equal(csp.includes('unsafe-inline'), false)
  assert.equal(csp.includes('unsafe-eval'), false)
  assert.ok(csp.includes("frame-ancestors 'none'"))
  assert.ok(headers.includes('microphone=()'))
  assert.ok(headers.includes('camera=()'))
  assert.ok(headers.includes('geolocation=()'))
  assert.ok(headers.includes('nosniff'))
  assert.ok(headers.includes('Referrer-Policy'))
  // 每个返回 HTML 的 location 都要带上这组响应头（location 里有 add_header 时不继承 server 级）
  for (const block of conf.split(/\n(?=location )/).filter((b) => b.includes('index.html') || b.includes('/404.html'))) {
    assert.ok(block.includes('quanquan-site-headers.conf'), block.split('\n')[0] ?? '')
  }
})
