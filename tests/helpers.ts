import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadContent, type SiteContent } from '../src/lib/loadContent.ts'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const TODAY = '2026-10-19'

/** 读取真实的 src/content 文件（测试里可以覆盖其中几个） */
export function contentFiles(): Record<string, string> {
  const dir = path.join(ROOT, 'src/content')
  const out: Record<string, string> = {}
  const walk = (d: string, prefix: string) => {
    for (const name of readdirSync(d)) {
      const full = path.join(d, name)
      const rel = prefix ? `${prefix}/${name}` : name
      if (statSync(full).isDirectory()) {
        walk(full, rel)
      } else if (/\.(ya?ml|json)$/.test(name)) {
        out[rel] = readFileSync(full, 'utf8')
      }
    }
  }
  walk(dir, '')
  return out
}

export function load(overrides: Record<string, string | undefined> = {}): SiteContent {
  const files = { ...contentFiles() }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete files[k]
    } else {
      files[k] = v
    }
  }
  return loadContent(files, { today: TODAY })
}

export function releasesWith(mutate: (r: Record<string, any>) => void): string {
  const releases = JSON.parse(contentFiles()['releases.json']!)
  mutate(releases)
  return JSON.stringify(releases)
}
