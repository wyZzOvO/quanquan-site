/**
 * 官网内容模型（需求文档第 14 章）。src/content 下的 YAML / JSON 在构建时逐个用这里的 Schema 校验，
 * 字段写错、多写、少写都会让构建失败；跨文件的规则（slug 唯一、渠道地址白名单等）见 validate.ts。
 * 只依赖 zod，Astro 页面与 Node 测试、脚本共用。
 */
import { z } from 'astro/zod'

const text = z.string().trim().min(1, { error: '不能为空' })
const isoDate = z.iso.date({ error: '日期格式应为 YYYY-MM-DD' })
/** 站内路径（/download/）或 https 地址；是否在白名单里由 validate.ts 检查 */
const href = z.string().trim().refine((v) => v.startsWith('/') || v.startsWith('https://'), {
  error: '链接只能是以 / 开头的站内路径或 https 地址',
})

// ============================== 公司 ==============================

/**
 * 公安联网备案号的完整文字，照全国互联网安全管理服务平台给出的写法：省简称 + 公网安备 + 14 位编号 + 号，
 * 例如 湘公网安备43010202000000号（"备"与编号之间有一个空格的写法也接受）。第 1 个分组是编号。
 */
export const PSB_TEXT_PATTERN = /^[一-龥]公网安备 ?(\d{14})号$/
/** 公安联网备案编号：14 位数字，页脚用它链接到平台的查询页 */
export const PSB_CODE_PATTERN = /^\d{14}$/

/** 公安联网备案：完整文字与编号都要填，且编号必须与文字里的一致 */
export const PsbFilingSchema = z
  .strictObject(
    {
      /** 页脚显示的完整文字，与平台给出的一字不差 */
      text: z
        .string({ error: (issue) => (issue.input === undefined ? '缺少完整文字 text' : 'text 应为文字') })
        .trim()
        .regex(PSB_TEXT_PATTERN, { error: '公安联网备案号格式不对，应为"湘公网安备43010202000000号"这样的写法' }),
      /** 备案编号（14 位数字）；YAML 里要加引号写成字符串，否则会被读成数字 */
      code: z
        .string({
          error: (issue) =>
            issue.input === undefined ? '缺少备案编号 code' : '备案编号要加引号写成字符串，如 "43010202000000"',
        })
        .trim()
        .regex(PSB_CODE_PATTERN, { error: '备案编号应为 14 位数字' }),
    },
    {
      // 旧写法 psb: 湘公网安备…号（只写一个字符串）也会落到这里
      error: (issue) =>
        issue.code === 'invalid_type'
          ? '公安联网备案要写成 text 与 code 两项（写法见 company.yaml 的注释），没有时写 null'
          : undefined,
    },
  )
  .refine(
    (v) => {
      // 字段本身不合格时只报字段的错，这里不重复报
      const m = typeof v.text === 'string' ? v.text.match(PSB_TEXT_PATTERN) : null
      return !m || typeof v.code !== 'string' || !PSB_CODE_PATTERN.test(v.code) || m[1] === v.code
    },
    { error: 'code 与完整文字里的编号不一致', path: ['code'] },
  )

export const ContactChannelSchema = z.strictObject({
  /** support 用户支持；business 商务合作；privacy 个人信息请求 */
  id: z.enum(['support', 'business', 'privacy']),
  label: text,
  type: z.literal('email'),
  value: z.email({ error: '邮箱格式不对' }),
  /** 已实际收发验证、有人维护。正式发布至少要有一个 true */
  verified: z.boolean(),
  note: text.optional(),
})

export const CompanySchema = z.strictObject({
  legalName: text,
  brandName: text,
  /** 统一社会信用代码（18 位） */
  unifiedSocialCreditCode: z.string().regex(/^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/, {
    error: '统一社会信用代码格式不对',
  }),
  foundedAt: isoDate,
  /** 登记所在地（只到区） */
  registeredRegion: text,
  addressRegion: text,
  addressLocality: text,
  introduction: text,
  /** 与玉米圈的关系 */
  relation: text,
  operator: z.strictObject({
    /** 公司已经是玉米圈的生效运营主体（协议、应用商店、备案都已对齐）后改为 true */
    effective: z.boolean(),
    /** effective = false 时在关于页、下载页展示的说明 */
    pendingNote: text,
  }),
  display: z.strictObject({
    /** 关于页是否展示统一社会信用代码（结构化数据同步） */
    creditCode: z.boolean(),
    foundedAt: z.boolean(),
  }),
  contacts: z.array(ContactChannelSchema).min(1),
  filings: z.strictObject({
    /** 网站 ICP 备案号（与域名、主体对应，不是 App 备案号）；未取得时为 null，页脚不展示 */
    icp: z.string().trim().nullable(),
    /** 公安联网备案：{ text: 湘公网安备43010202000000号, code: "43010202000000" }；未取得时为 null，页脚不展示 */
    psb: PsbFilingSchema.nullable(),
  }),
})

// ============================== 产品 ==============================

export const ProductSchema = z.strictObject({
  name: text,
  /** 统一产品定义（GEO：各处保持一致） */
  definition: text,
  shortDescription: text,
  /** 已对用户开放的能力；false 时官网隐藏对应宣传 */
  capabilities: z.strictObject({
    teamList: z.boolean(),
    companions: z.boolean(),
    findAssistant: z.boolean(),
    teamVoice: z.boolean(),
    webVoice: z.boolean(),
    squads: z.boolean(),
    nextPlans: z.boolean(),
    campaigns: z.boolean(),
    feedback: z.boolean(),
    joinGuide: z.boolean(),
  }),
  /** 最低年龄，与协议一致 */
  minAge: z.number().int().min(14).max(18),
  /** 收费说明（来自当前商业化配置，不写"永久免费""全部免费"） */
  pricingNote: text,
})

// ============================== 下载与网页版 ==============================

export const CHANNEL_STATUSES = ['available', 'beta', 'coming_soon', 'maintenance', 'unsupported'] as const
export type ChannelStatus = (typeof CHANNEL_STATUSES)[number]

export const DownloadChannelSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/, { error: 'id 只能用小写字母、数字和 -' }),
  platform: z.enum(['ios', 'android']),
  /** app_store / testflight / android_store（应用商店）/ apk（官方安装包） */
  kind: z.enum(['app_store', 'testflight', 'android_store', 'apk']),
  label: text,
  status: z.enum(CHANNEL_STATUSES),
  url: z.string().trim().nullable(),
  version: z.string().trim().nullable(),
  releasedAt: isoDate.nullable(),
  /** 最低系统要求，例如"需要 iOS 15.0 或更高版本" */
  requirement: z.string().trim().nullable(),
  /** coming_soon / maintenance 必填：当前状态说明或替代途径 */
  note: z.string().trim().nullable(),
  /** beta 必填：测试范围 */
  betaScope: z.string().trim().nullable(),
  /** apk 必填：正式签名安装包的大小与 SHA-256 */
  apk: z
    .strictObject({
      sizeBytes: z.number().int().positive(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/, { error: 'SHA-256 应为 64 位小写十六进制' }),
    })
    .nullable(),
})

export const ReleasesSchema = z.strictObject({
  schemaVersion: z.literal(1),
  product: text,
  /** 发布配置最后一次实质修改的日期 */
  updatedAt: isoDate,
  channels: z.array(DownloadChannelSchema),
  web: z.strictObject({
    /** 网页版是否已达到发布条件；false 时全站隐藏"进入网页版" */
    enabled: z.boolean(),
    /** 同域路径（/web/）或白名单内的 https 地址 */
    url: href,
    /** 网页版可用范围说明 */
    note: text,
  }),
  /** 下载渠道允许的域名（available / beta 的地址必须在这里） */
  allowedHosts: z.array(z.string().regex(/^[a-z0-9.-]+$/)).min(1),
})

// ============================== 游戏专题 ==============================

export const SUPPORT_STATUSES = ['open', 'planned'] as const

const LinkSchema = z.strictObject({ label: text, href })

const OfficialFactSchema = z.strictObject({
  text,
  sourceName: text,
  sourceUrl: z.url({ protocol: /^https$/, error: '来源必须是 https 地址' }),
})

export const GameTitleSchema = z.strictObject({
  /** 后端游戏字典里的 code（game.code）；网页版找队用它带参数 */
  code: z.string().regex(/^[a-z0-9_]+$/),
  name: text,
  englishName: text,
  /** open 已开放找队；planned 规划中（不放找队操作） */
  supportStatus: z.enum(SUPPORT_STATUSES),
  /** 玉米圈当前开放的平台（不是游戏本身支持的全部平台） */
  openPlatforms: z.array(text),
  /** 平台与联机的补充说明（玉米圈当前规则） */
  platformNote: text,
  officialSite: z.url({ protocol: /^https$/ }),
})

export const GamePageSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  /** draft 不生成页面、不进站点地图和结构化数据 */
  status: z.enum(['published', 'draft']),
  order: z.number().int().positive(),
  /** primary：首页与总览的大卡；secondary：次级卡 */
  tier: z.enum(['primary', 'secondary']),
  displayName: text,
  englishName: text,
  /** 卡片插画（src/components/art 下的原创插画） */
  art: z.enum(['split-fiction', 'stardew-valley', 'terraria', 'monster-hunter']),
  seo: z.strictObject({
    title: text,
    description: text,
    keywords: z.array(text).max(8),
  }),
  card: z.strictObject({ tagline: text, summary: text }),
  h1: text,
  /** 开头直接回答"这个页面解决什么问题"的一段话 */
  lead: text,
  titles: z.array(GameTitleSchema).min(1),
  scenes: z.array(z.strictObject({ title: text, text })).min(2).max(6),
  agreements: z.strictObject({ intro: text, items: z.array(z.strictObject({ title: text, text })).min(2).max(8) }),
  steps: z.array(z.strictObject({ title: text, text })).length(3),
  compatibility: z.strictObject({
    /** 游戏官方规则摘要（必须带官方来源） */
    officialFacts: z.array(OfficialFactSchema),
    /** 官方规则的核对日期 */
    checkedAt: isoDate,
    /** 玉米圈当前开放的找队能力 */
    productNotes: z.array(text).min(1),
    /** 组队前需要自己确认的事项 */
    userChecks: z.array(text).min(1),
  }),
  faqs: z
    .array(z.strictObject({ id: z.string().regex(/^[a-z0-9-]+$/), question: text, answer: text }))
    .min(2),
  /** 截图：src/assets/screens 下登记过的文件名（不含扩展名）；没有合适截图时为 null，改用 demoParty */
  screen: z.string().regex(/^[a-z0-9-]+$/).nullable(),
  screenAlt: text.nullable(),
  /** 队伍卡片的界面示意（演示数据），1–3 张 */
  demoParties: z
    .array(
      z.strictObject({
        initial: z.string().trim().length(1),
        title: text,
        meta: text,
        tags: z.array(z.strictObject({ text, tone: z.enum(['green', 'amber', 'violet', 'gray']) })).max(5),
        host: text,
        action: text,
        reason: text.optional(),
      }),
    )
    .max(3),
  related: z.array(z.string().regex(/^[a-z0-9-]+$/)),
  reviewedBy: text,
  /** 实质更新日期（只有内容实质变化才改） */
  updatedAt: isoDate,
  /** 适用范围说明 */
  scope: text,
})

// ============================== 帮助 FAQ ==============================

export const FaqSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  category: z.enum(['product', 'start', 'voice', 'account', 'safety', 'privacy']),
  question: text,
  /** 支持 [文字](/站内路径/) 或 [文字](https://白名单地址) 形式的链接，段落之间空一行 */
  answer: text,
  /** 只有对应能力开放时才显示（product.capabilities 的键） */
  requires: z.string().optional(),
  updatedAt: isoDate,
})

export const FaqFileSchema = z.strictObject({ faqs: z.array(FaqSchema).min(1) })

// ============================== 素材登记 ==============================

export const AssetSchema = z.strictObject({
  /** 相对 src/assets 的路径 */
  path: z.string().regex(/^[a-z0-9/_.-]+$/),
  /** 产品截图描述功能；装饰图写空字符串 */
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** 来源与权利：自制截图、原创插画、公司自有标识等 */
  rightsSource: text,
  approvalState: z.enum(['approved', 'pending']),
  /** 截图是否只含演示数据 */
  demoDataOnly: z.boolean(),
})

export const AssetFileSchema = z.strictObject({ assets: z.array(AssetSchema).min(1) })

// ============================== 站点设置 ==============================

export const SiteSettingsSchema = z.strictObject({
  siteName: text,
  /** 搜索平台站点验证码（不是密钥，可以公开）；没有就写 null */
  verification: z.strictObject({
    baidu: z.string().trim().nullable(),
    google: z.string().trim().nullable(),
    bing: z.string().trim().nullable(),
    so360: z.string().trim().nullable(),
    sogou: z.string().trim().nullable(),
  }),
  crawlers: z.strictObject({
    /** 是否允许 GPTBot、ClaudeBot、Google-Extended 等训练用途的爬虫（需求文档 18.1：搜索与训练分开管理） */
    allowTraining: z.boolean(),
  }),
  /** 页脚说明游戏名称与商标的归属 */
  trademarkNotice: text,
})

export type Company = z.infer<typeof CompanySchema>
export type PsbFiling = z.infer<typeof PsbFilingSchema>
export type ContactChannel = z.infer<typeof ContactChannelSchema>
export type Product = z.infer<typeof ProductSchema>
export type Releases = z.infer<typeof ReleasesSchema>
export type DownloadChannel = z.infer<typeof DownloadChannelSchema>
export type GamePage = z.infer<typeof GamePageSchema>
export type GameTitle = z.infer<typeof GameTitleSchema>
export type Faq = z.infer<typeof FaqSchema>
export type Asset = z.infer<typeof AssetSchema>
export type SiteSettings = z.infer<typeof SiteSettingsSchema>
export type Link = z.infer<typeof LinkSchema>
