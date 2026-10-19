/**
 * 下载页的设备识别（需求文档 8.1）：只标出建议的平台，不自动跳转、不自动下载；
 * 在微信、QQ 等内置浏览器里提示"在浏览器打开"，并提供复制网址。识别不了的设备不做任何标注。
 */
const ua = navigator.userAgent
const touchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
const isIos = /iPhone|iPad|iPod/i.test(ua) || touchMac
const isAndroid = /Android/i.test(ua)
const inApp = /MicroMessenger|\bQQ\/|\bWeibo|DingTalk|AlipayClient/i.test(ua)

const platform = isIos ? 'ios' : isAndroid ? 'android' : null
if (platform) {
  const card = document.querySelector<HTMLElement>(`[data-platform="${platform}"]`)
  const hint = document.querySelector<HTMLElement>('[data-device-hint]')
  if (card) {
    card.classList.add('suggested')
    const badge = card.querySelector<HTMLElement>('[data-suggested-badge]')
    if (badge) {
      badge.hidden = false
    }
  }
  if (hint) {
    hint.textContent = platform === 'ios' ? '你正在使用 iPhone 或 iPad，下面已标出对应版本。' : '你正在使用 Android 手机，下面已标出对应版本。'
    hint.hidden = false
  }
}

if (inApp) {
  const wechat = document.querySelector<HTMLElement>('[data-wechat-hint]')
  if (wechat) {
    wechat.hidden = false
  }
}
