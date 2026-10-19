#!/usr/bin/env node
/**
 * 本地预览构建产物：按正式 nginx 的规则提供 dist/（deploy/nginx/quanquan-site.conf），用来在上线前检查
 * 真实状态码（404 不是软 404）、结尾斜杠 301、缓存头和安全响应头（CSP 不允许内联脚本）。
 *   node scripts/serve-dist.mjs            # http://localhost:4322
 *   PORT=8080 node scripts/serve-dist.mjs
 * /legal/ 用本机 quanquan 仓库导出的协议网页（../quanquan/src/main/resources/static/legal），其他业务路由在本地返回 404 说明。
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { SECURITY_HEADERS, SITE_DIRECTORIES, isReservedPath } from './lib/routes.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const LEGAL = path.resolve(ROOT, '../quanquan/src/main/resources/static/legal')
const PORT = Number(process.env.PORT || 4322)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
}

async function fileAt(base, rel) {
  const full = path.join(base, rel)
  if (!full.startsWith(base)) {
    return null
  }
  try {
    const s = await stat(full)
    return s.isFile() ? full : null
  } catch {
    return null
  }
}

// 本地是 http，去掉 upgrade-insecure-requests，否则浏览器会把同源资源升级成 https 而加载失败
const HEADERS = {
  ...SECURITY_HEADERS,
  'Content-Security-Policy': SECURITY_HEADERS['Content-Security-Policy'].replace(/;\s*upgrade-insecure-requests/, ''),
}

function send(res, status, body, type, extra = {}) {
  res.writeHead(status, { 'Content-Type': type, ...HEADERS, ...extra })
  res.end(body)
}

async function notFound(res) {
  const page = await readFile(path.join(DIST, '404.html'))
  send(res, 404, page, TYPES['.html'], { 'Cache-Control': 'no-store' })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const pathname = decodeURIComponent(url.pathname)

  if (pathname.startsWith('/legal/') || pathname === '/legal') {
    const rel = pathname === '/legal' || pathname === '/legal/' ? 'index.html' : pathname.slice('/legal/'.length)
    const file = await fileAt(LEGAL, rel)
    if (file) {
      return send(res, 200, await readFile(file), TYPES['.html'], { 'Cache-Control': 'no-cache' })
    }
    return send(res, 404, '本机没有找到协议导出文件（../quanquan/src/main/resources/static/legal）', TYPES['.txt'])
  }
  if (isReservedPath(pathname)) {
    return send(res, 404, `本地预览不包含业务路由 ${pathname}（线上由后端或网页版处理）`, TYPES['.txt'])
  }

  // 目录型页面：没有结尾斜杠的 301 到带斜杠的地址
  const dirMatch = pathname.match(/^\/([a-z-]+)(\/[a-z0-9-]+)?$/)
  if (dirMatch && SITE_DIRECTORIES.includes(dirMatch[1])) {
    res.writeHead(301, { Location: `${pathname}/${url.search}`, ...HEADERS })
    return res.end()
  }

  let rel = pathname === '/' ? 'index.html' : pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.slice(1)
  if (rel === '404.html') {
    return notFound(res)
  }
  const file = await fileAt(DIST, rel)
  if (!file) {
    return notFound(res)
  }
  const ext = path.extname(file)
  const cache = rel.startsWith('_site/') ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=3600'
  send(res, 200, await readFile(file), TYPES[ext] ?? 'application/octet-stream', { 'Cache-Control': cache })
})

server.listen(PORT, () => {
  console.log(`官网预览：http://localhost:${PORT}/（与正式 nginx 相同的路由与响应头）`)
})
