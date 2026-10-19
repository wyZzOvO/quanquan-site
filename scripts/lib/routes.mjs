/**
 * 路由接管清单（需求文档 13.2、25.4）：官网只接管这里列出的路径，其他一律留给现有业务。
 * 本地预览服务器、产物检查、nginx 配置的测试都用这一份清单。
 */

/** 官网管理的目录型页面（/games/terraria/ 这类，统一结尾斜杠） */
export const SITE_DIRECTORIES = ['features', 'games', 'download', 'about', 'support']

/** 官网根目录下的单个文件 */
export const SITE_ROOT_FILES = [
  'index.html',
  '404.html',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'favicon.ico',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
]

/** 官网的静态资源前缀 */
export const SITE_ASSET_PREFIXES = ['/_site/', '/og/']

/** 必须保留给现有业务的路由（后端、网页版、协议、分享、推广、关联文件） */
export const RESERVED_PREFIXES = ['/web', '/api/', '/im', '/s/', '/r/', '/t/', '/creator', '/legal', '/.well-known/', '/v3/', '/swagger-ui']

export function isReservedPath(pathname) {
  return RESERVED_PREFIXES.some((p) => pathname === p.replace(/\/$/, '') || pathname.startsWith(p))
}

/**
 * 官网的安全响应头（需求文档 19.3）：不允许内联脚本与样式，禁止被嵌入，禁用麦克风、摄像头、定位。
 * JSON-LD 是 <script type="application/ld+json"> 数据块，浏览器不执行，不受 script-src 限制。
 * /web/ 有自己的 CSP 与麦克风权限，不能套用这一组。
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'microphone=(), camera=(), geolocation=(), payment=(), usb=()',
}
