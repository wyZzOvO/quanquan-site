/**
 * 移动端菜单增强（需求文档 FR17）：菜单本身是 <details>，没有脚本也能开关；
 * 这里补上 Esc 关闭并把焦点还给按钮、点链接后收起、打开时锁定页面滚动、切到桌面宽度时自动收起。
 */
const menu = document.querySelector<HTMLDetailsElement>('[data-nav-menu]')
const toggle = menu?.querySelector<HTMLElement>('[data-nav-toggle]')

if (menu && toggle) {
  const root = document.documentElement
  const sync = () => {
    root.classList.toggle('menu-open', menu.open)
    toggle.setAttribute('aria-label', menu.open ? '关闭菜单' : '打开菜单')
  }
  const close = (restoreFocus: boolean) => {
    if (!menu.open) {
      return
    }
    menu.open = false
    sync()
    if (restoreFocus) {
      toggle.focus()
    }
  }

  menu.addEventListener('toggle', sync)
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      event.preventDefault()
      close(true)
    }
  })
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => close(false)))
  const desktop = window.matchMedia('(min-width: 834px)')
  desktop.addEventListener('change', (event) => {
    if (event.matches) {
      close(false)
    }
  })
  sync()
}
