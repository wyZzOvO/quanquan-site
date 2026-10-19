/**
 * 复制到剪贴板：只响应用户点击（官网普通浏览不读写剪贴板，需求文档 8.3）。
 */
document.querySelectorAll<HTMLElement>('[data-copy-wrap]').forEach((wrap) => {
  wrap.hidden = false
  const button = wrap.querySelector<HTMLButtonElement>('[data-copy]')
  const status = wrap.querySelector<HTMLElement>('[data-copy-status]')
  if (!button || !status) {
    return
  }
  let timer = 0
  button.addEventListener('click', async () => {
    const value = button.dataset.copy ?? ''
    let ok = false
    try {
      await navigator.clipboard.writeText(value)
      ok = true
    } catch {
      ok = fallbackCopy(value)
    }
    status.textContent = ok ? '已复制' : '复制失败，请长按或手动选择文字复制'
    status.style.color = ok ? '' : 'var(--text-2)'
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      status.textContent = ''
    }, 3000)
  })
})

function fallbackCopy(value: string): boolean {
  const area = document.createElement('textarea')
  area.value = value
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  area.remove()
  return ok
}
