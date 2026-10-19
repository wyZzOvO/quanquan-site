/**
 * 入场动效（需求文档 11.2）：只给首屏以外、带 data-reveal 的元素加淡入与 14px 位移，每个元素只触发一次。
 * 首屏内的元素不处理（不会先消失再出现）；减弱动效或不支持 IntersectionObserver 时什么都不做，内容始终可见。
 */
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

if (!reduce && 'IntersectionObserver' in window) {
  const items = [...document.querySelectorAll<HTMLElement>('[data-reveal]')]
  const viewport = window.innerHeight
  const pending = items.filter((el) => el.getBoundingClientRect().top > viewport * 0.92)

  if (pending.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue
          }
          const el = entry.target as HTMLElement
          el.classList.add('reveal-in')
          el.classList.remove('reveal-pending')
          observer.unobserve(el)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    for (const el of pending) {
      // 同一组里的元素依次错开，最多 80ms（data-reveal="1"、"2"…）
      const order = Number(el.dataset.reveal || 0)
      if (order > 0) {
        el.style.setProperty('--reveal-delay', `${Math.min(order, 4) * 20}ms`)
      }
      el.classList.add('reveal-pending')
      observer.observe(el)
    }
  }
}
