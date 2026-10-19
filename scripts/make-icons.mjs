#!/usr/bin/env node
/**
 * 由 App 图标（src/assets/brand/app-icon-source.png，取自 ju-mobile 的 1024 图标，四角是黑色）生成：
 *   public/favicon.ico（16 / 32 / 48）、public/apple-touch-icon.png（180）、public/icon-192.png、public/icon-512.png
 *   src/assets/brand/mark.png：去掉白底的"S"标识（导航与页脚用，透明底）
 * 用法：node scripts/make-icons.mjs
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(ROOT, 'src/assets/brand/app-icon-source.png')
const PUBLIC = path.join(ROOT, 'public')
/** 裁掉四角黑色圆角外的区域，得到满版白底图标 */
const INSET = 56

async function fullBleed() {
  const meta = await sharp(SOURCE).metadata()
  const size = (meta.width ?? 1024) - INSET * 2
  return sharp(SOURCE).extract({ left: INSET, top: INSET, width: size, height: size }).png().toBuffer()
}

async function png(buffer, size) {
  return sharp(buffer).resize(size, size, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer()
}

/** ICO 容器里直接放 PNG（Vista 起所有浏览器都支持） */
function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  const dir = Buffer.alloc(16 * images.length)
  let offset = 6 + dir.length
  images.forEach(({ size, data }, i) => {
    const o = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, o)
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1)
    dir.writeUInt8(0, o + 2)
    dir.writeUInt8(0, o + 3)
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(data.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += data.length
  })
  return Buffer.concat([header, dir, ...images.map((i) => i.data)])
}

async function main() {
  const base = await fullBleed()
  await writeFile(path.join(PUBLIC, 'apple-touch-icon.png'), await png(base, 180))
  await writeFile(path.join(PUBLIC, 'icon-192.png'), await png(base, 192))
  await writeFile(path.join(PUBLIC, 'icon-512.png'), await png(base, 512))
  const sizes = [16, 32, 48]
  const images = await Promise.all(sizes.map(async (size) => ({ size, data: await png(base, size) })))
  await writeFile(path.join(PUBLIC, 'favicon.ico'), ico(images))

  // 标识：亮度取反作为透明度，黑色笔画保留、白底变透明，再裁掉四周空白
  const gray = await sharp(base).greyscale().negate().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = gray.info
  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const a = gray.data[i] ?? 0
    rgba[i * 4] = 22
    rgba[i * 4 + 1] = 22
    rgba[i * 4 + 2] = 30
    // 压掉底色里的轻微噪点
    rgba[i * 4 + 3] = a < 24 ? 0 : a
  }
  const mark = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .trim({ threshold: 1 })
    .png()
    .toBuffer()
  const trimmed = await sharp(mark).resize({ height: 192 }).png({ compressionLevel: 9 }).toFile(path.join(ROOT, 'src/assets/brand/mark.png'))
  console.log('mark.png', trimmed.width, '×', trimmed.height)
  console.log('已生成 favicon.ico、apple-touch-icon.png、icon-192.png、icon-512.png')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
