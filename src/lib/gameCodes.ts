/**
 * 后端游戏字典里已有的游戏编码（quanquan 仓库 src/main/resources/db/manual/02_seed_dictionary.sql 的 game.code）。
 * 官网的游戏页用它给网页版带参数（/web/tonight?game=…）；编码写错会让网页版找不到游戏，所以构建时校验。
 * 后端新增游戏后在这里补上（tests/gameCodes.test.ts 会在本机有 quanquan 仓库时核对两边一致）。
 */
export const BACKEND_GAME_CODES: ReadonlySet<string> = new Set([
  'split_fiction',
  'stardew_valley',
  'terraria',
  'mhw',
  'mhwilds',
])
