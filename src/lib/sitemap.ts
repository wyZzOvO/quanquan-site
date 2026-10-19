import type { SitemapEntry } from './pages.ts'
import { absoluteUrl } from './seo.ts'
import { escapeHtml } from './links.ts'

export function buildSitemap(siteUrl: string, entries: readonly SitemapEntry[]): string {
  const seen = new Set<string>()
  const urls = entries
    .filter((e) => {
      if (seen.has(e.path)) {
        return false
      }
      seen.add(e.path)
      return true
    })
    .map((e) => `  <url>\n    <loc>${escapeHtml(absoluteUrl(siteUrl, e.path))}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`)
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...urls, '</urlset>', ''].join('\n')
}
