/**
 * 官网用到的游戏编码要在后端游戏字典里存在（本机有 quanquan 仓库时核对；没有就跳过）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { BACKEND_GAME_CODES } from '../src/lib/gameCodes.ts'
import { ROOT } from './helpers.ts'

const SEED = path.resolve(ROOT, '../quanquan/src/main/resources/db/manual/02_seed_dictionary.sql')

test('游戏编码与后端字典一致', { skip: !existsSync(SEED) && '本机没有 quanquan 仓库' }, () => {
  const sql = readFileSync(SEED, 'utf8')
  for (const code of BACKEND_GAME_CODES) {
    assert.ok(sql.includes(`'${code}'`), `后端字典里没有 ${code}`)
  }
})
