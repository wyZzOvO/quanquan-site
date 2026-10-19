// @ts-check
import { defineConfig } from 'astro/config'
import { resolveSiteEnv } from './src/lib/env.ts'

// 正式域名、环境由环境变量决定（见 README「环境变量」）：
//   SITE_URL  正式站点根地址，不带结尾斜杠，默认 https://www.monster-ovo.cn
//   SITE_ENV  production | preview | development；只有 production 允许搜索引擎收录
const env = resolveSiteEnv(process.env)

export default defineConfig({
  site: env.siteUrl,
  // 目录型页面统一结尾斜杠（/games/terraria/），与 nginx 的 301 规则一致；robots.txt 等带扩展名的文件不受影响
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // 带内容哈希的 CSS / JS / 图片都放在 /_site/ 下，nginx 对这个前缀长缓存（immutable）
    assets: '_site',
    // 样式一律输出为外部文件：CSP 不需要为内联样式开口子
    inlineStylesheets: 'never',
  },
  // 保留单个空格（Astro 7 默认的 'jsx' 会去掉跨行的行内空白）
  compressHTML: true,
  devToolbar: { enabled: false },
  prefetch: false,
  vite: {
    build: {
      // 脚本、图片都不内联进 HTML：正式站的 CSP 不允许内联脚本
      assetsInlineLimit: 0,
    },
  },
})
