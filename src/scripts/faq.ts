/**
 * FAQ 增强：地址里带 #faq-xxx 时展开并定位到对应问题（便于分享）；打印前展开全部，打印出来是完整内容。
 */
function openFromHash(): void {
  const id = decodeURIComponent(location.hash.slice(1))
  if (!id) {
    return
  }
  const target = document.getElementById(id)
  if (target instanceof HTMLDetailsElement) {
    target.open = true
    target.scrollIntoView({ block: 'start' })
  }
}

openFromHash()
window.addEventListener('hashchange', openFromHash)

const reopen: HTMLDetailsElement[] = []
window.addEventListener('beforeprint', () => {
  document.querySelectorAll('details').forEach((d) => {
    if (!d.open) {
      d.open = true
      reopen.push(d)
    }
  })
})
window.addEventListener('afterprint', () => {
  reopen.splice(0).forEach((d) => {
    d.open = false
  })
})
