/**
 * Node 脚本里读取 src/content（与 Astro 页面用同一套校验，见 src/lib/loadContent.ts）。
 */
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loadContent } from '../../src/lib/loadContent.ts'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const CONTENT_DIR = path.join(ROOT, 'src/content')

async function walk(dir, prefix = '') {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      out.push(...(await walk(path.join(dir, entry.name), rel)))
    } else if (/\.(ya?ml|json)$/.test(entry.name)) {
      out.push(rel)
    }
  }
  return out
}

export async function readContentFiles() {
  const files = {}
  for (const rel of await walk(CONTENT_DIR)) {
    files[rel] = await readFile(path.join(CONTENT_DIR, rel), 'utf8')
  }
  return files
}

export async function loadSiteContent(options) {
  return loadContent(await readContentFiles(), options)
}
