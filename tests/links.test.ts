import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSafeHref, paragraphs, plainText, renderInline, withBreaks, withoutBreaks } from '../src/lib/links.ts'

test('只接受站内路径、白名单 https 与邮箱链接', () => {
  for (const ok of ['/download/', '/legal/privacy-policy.html', '/support/#contact', 'https://www.ea.com/games/split-fiction/split-fiction', 'mailto:a@b.cn']) {
    assert.equal(isSafeHref(ok), true, ok)
  }
  for (const bad of [
    'javascript:alert(1)',
    'data:text/html,hi',
    '//evil.cn/x',
    'http://www.ea.com/',
    'https://evil.cn/',
    'https://user:pass@www.ea.com/',
    'https://www.ea.com:8443/',
    '/\\evil.cn',
    'download/',
  ]) {
    assert.equal(isSafeHref(bad), false, bad)
  }
})

test('正文先整体转义，再把白名单链接换成 <a>', () => {
  assert.equal(
    renderInline('看<b>这里</b>：[下载页](/download/)'),
    '看&lt;b&gt;这里&lt;/b&gt;：<a href="/download/">下载页</a>',
  )
  assert.equal(renderInline('[邮箱](mailto:a@b.cn)'), '<a href="mailto:a@b.cn">邮箱</a>')
  assert.throws(() => renderInline('[点我](javascript:alert(1))'))
  assert.throws(() => renderInline('[点我](https://evil.cn/)'))
})

test('纯文本与分段', () => {
  assert.equal(plainText('见[隐私政策](/legal/privacy-policy.html)。'), '见隐私政策。')
  assert.deepEqual(paragraphs('第一段\n接着写\n\n第二段\n'), ['第一段接着写', '第二段'])
})

test('标题里的 | 是建议换行处', () => {
  assert.equal(withBreaks('找到作息合拍的|星露谷<农友>'), '找到作息合拍的<wbr>星露谷&lt;农友&gt;')
  assert.equal(withoutBreaks('找到作息合拍的|星露谷农友'), '找到作息合拍的星露谷农友')
})
