#!/usr/bin/env node
/**
 * 构建入口：类型检查 → 构建 → 产物检查；--production 时再跑正式发布检查（备案号、联系渠道、素材审核等）。
 *   node scripts/build.mjs                # 预览构建（noindex，robots 禁止抓取）
 *   node scripts/build.mjs --production   # 正式构建，SITE_URL 默认 https://www.monster-ovo.cn
 * 三个步骤使用同一个 SITE_ENV / SITE_URL。
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const production = process.argv.includes('--production')
const env = { ...process.env, SITE_ENV: production ? 'production' : process.env.SITE_ENV || 'preview' }

function run(cmd, args) {
  console.log(`\n▶ ${[cmd, ...args].join(' ')}  (SITE_ENV=${env.SITE_ENV}${env.SITE_URL ? `, SITE_URL=${env.SITE_URL}` : ''})`)
  const result = spawnSync(cmd, args, { cwd: ROOT, env, stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`\n✗ ${cmd} ${args.join(' ')} 失败，构建中止`)
    process.exit(result.status ?? 1)
  }
}

const astro = path.join(ROOT, 'node_modules/.bin/astro')
run(astro, ['check'])
run(astro, ['build'])
run(process.execPath, ['scripts/check-dist.mjs'])
if (production) {
  run(process.execPath, ['scripts/check-release.mjs'])
}
console.log(`\n✓ ${production ? '正式' : '预览'}构建完成：dist/`)
