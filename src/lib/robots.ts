/**
 * robots.txt 生成（纯函数，便于测试）。
 */

/** 不需要抓取的业务路径（与后端、nginx 的实际路由对应） */
export const DISALLOWED_PATHS = ['/api/', '/im', '/admin/', '/creator', '/v3/api-docs', '/swagger-ui'] as const

/** 搜索 / 用户触发的 AI 检索爬虫：允许读取公开页面 */
export const SEARCH_AGENTS = [
  'Baiduspider',
  'Sogou web spider',
  '360Spider',
  'YisouSpider',
  'Bytespider',
  'Googlebot',
  'Bingbot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Applebot',
] as const

/** 训练用途的爬虫：由 allowTraining 决定 */
export const TRAINING_AGENTS = [
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'meta-externalagent',
] as const

export interface RobotsOptions {
  siteUrl: string
  indexable: boolean
  allowTraining: boolean
}

function group(agents: readonly string[], allow: boolean): string {
  const lines = agents.map((a) => `User-agent: ${a}`)
  if (allow) {
    lines.push('Allow: /')
    for (const path of DISALLOWED_PATHS) {
      lines.push(`Disallow: ${path}`)
    }
  } else {
    lines.push('Disallow: /')
  }
  return lines.join('\n')
}

export function buildRobots({ siteUrl, indexable, allowTraining }: RobotsOptions): string {
  if (!indexable) {
    return ['# 预览 / 开发环境：禁止抓取', 'User-agent: *', 'Disallow: /', ''].join('\n')
  }
  return [
    '# 半拍官网：公开页面允许搜索抓取；接口与后台不抓取。robots 不是访问控制。',
    group(['*'], true),
    '',
    '# 搜索与用户触发的检索（规则与上面相同，单独列出的爬虫组不继承 * 组）',
    group(SEARCH_AGENTS, true),
    '',
    `# 训练用途的爬虫：${allowTraining ? '允许' : '不允许'}（src/content/site.yaml 的 crawlers.allowTraining）`,
    group(TRAINING_AGENTS, allowTraining),
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n')
}
