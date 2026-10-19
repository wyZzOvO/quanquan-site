/** 2026-10-19 → 2026年10月19日 */
export function formatDateZh(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}年${m}月${d}日`
}
