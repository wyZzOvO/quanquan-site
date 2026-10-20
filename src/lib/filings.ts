/**
 * 备案信息的展示与发布检查（页脚、check-release 共用，Node 测试直接引用）。
 * - 网站 ICP 备案号链接到工信部备案查询；
 * - 公安联网备案号链接到全国互联网安全管理服务平台的查询页，页脚在号码前显示本站自制的公安备案图标（不外链官方图片）；
 * - 没填的不展示，也不用示例字符串占位。
 * 字段格式由 schema.ts 的 CompanySchema（filings）校验，这里拿到的都是合法值。
 */
import { ICP_PATTERN } from './loadContent.ts'
import type { Company } from './schema.ts'

type Filings = Company['filings']

/** 工信部 ICP / IP 地址 / 域名信息备案管理系统 */
export const ICP_QUERY_URL = 'https://beian.miit.gov.cn/'

/** 全国互联网安全管理服务平台的备案查询页，后面接 14 位备案编号 */
export const PSB_QUERY_URL_PREFIX = 'https://beian.mps.gov.cn/#/query/webSearch?code='

export function psbQueryUrl(code: string): string {
  return `${PSB_QUERY_URL_PREFIX}${encodeURIComponent(code)}`
}

export interface FilingLink {
  kind: 'icp' | 'psb'
  /** 页脚显示的文字（备案号原文） */
  text: string
  href: string
}

/** 页脚要展示的备案号，按 ICP、公安的顺序；没有填的不出现 */
export function footerFilings(filings: Filings): FilingLink[] {
  const links: FilingLink[] = []
  if (filings.icp) {
    links.push({ kind: 'icp', text: filings.icp, href: ICP_QUERY_URL })
  }
  if (filings.psb) {
    links.push({ kind: 'psb', text: filings.psb.text, href: psbQueryUrl(filings.psb.code) })
  }
  return links
}

export interface ReleaseCheck {
  ok: string[]
  /** 提醒项：不阻断发布 */
  notes: string[]
  /** 阻断项：正式站不能发布 */
  failures: string[]
}

/**
 * 正式发布检查里的备案部分：
 * - 网站 ICP 备案号必须有、格式正确、不是 App 备案号，否则不能发布（大陆服务器上的网站必须先备案）；
 * - 公安联网备案号没有时只提醒：按《计算机信息网络国际联网安全保护管理办法》第十二条，在网站开通之日起三十日内办理，
 *   所以首次上线时可以还没有。
 */
export function filingReleaseChecks(filings: Filings): ReleaseCheck {
  const result: ReleaseCheck = { ok: [], notes: [], failures: [] }
  const icp = filings.icp
  if (!icp) {
    result.failures.push('网站 ICP 备案号未填写（src/content/company.yaml → filings.icp）。大陆服务器上的网站必须先完成备案')
  } else if (/A$/i.test(icp) || !ICP_PATTERN.test(icp)) {
    result.failures.push(`网站 ICP 备案号不正确：${icp}`)
  } else {
    result.ok.push(`网站 ICP 备案号 ${icp}`)
  }
  if (filings.psb) {
    result.ok.push(`公安联网备案号 ${filings.psb.text}（页脚链接 ${psbQueryUrl(filings.psb.code)}）`)
  } else {
    result.notes.push(
      '公安联网备案号未填写：网站开通后 30 日内在全国互联网安全管理服务平台办理（quanquan 仓库 docs/psb-filing/README.md），' +
        '取得后填 company.yaml → filings.psb 的 text 与 code，页脚会自动显示公安备案图标与查询链接',
    )
  }
  return result
}
