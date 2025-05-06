/* eslint no-script-url:0 */

import {
  asyncSanitizedMarked,
  sanitizedMarked,
  singleLineRenderer,
} from 'sentry/utils/marked/marked';
import {loadPrismLanguage} from 'sentry/utils/prism';

jest.unmock('prismjs');

function expectMarkdown(test: any) {
  expect(sanitizedMarked(test[0])).toEqual('<p>' + test[1] + '</p>\n');
}

describe('marked', function () {
  beforeAll(async () => {
    await loadPrismLanguage('javascript', {});
  });

  it('normal links get rendered as html', function () {
    for (const test of [
      ['[x](http://example.com)', '<a href="http://example.com">x</a>'],
      ['[x](https://example.com)', '<a href="https://example.com">x</a>'],
      ['[x](mailto:foo@example.com)', '<a href="mailto:foo@example.com">x</a>'],
      [
        '[x](https://example.com "Example Title")',
        '<a title="Example Title" href="https://example.com">x</a>',
      ],
    ]) {
      expectMarkdown(test);
    }
  });

  it('renders inline code blocks', function () {
    expect(sanitizedMarked('`foo`')).toBe('<p><code>foo</code></p>\n');
  });

  it('rejected links should be rendered as plain text', function () {
    for (const test of [
      ['[x](javascript:foo)', '<a>x</a>'],
      ['[x](java\nscript:foo)', '[x](java\nscript:foo)'],
      ['[x](data:foo)', '<a>x</a>'],
      ['[x](vbscript:foo)', '<a>x</a>'],
    ]) {
      expectMarkdown(test);
    }
  });

  it('normal images get rendered as html', function () {
    for (const test of [
      ['![](http://example.com)', '<img alt="" src="http://example.com">'],
      ['![x](http://example.com)', '<img alt="x" src="http://example.com">'],
      ['![x](https://example.com)', '<img alt="x" src="https://example.com">'],
    ]) {
      expectMarkdown(test);
    }
  });

  it("rejected images shouldn't be rendered at all", function () {
    for (const test of [['![x](javascript:foo)', '<img alt="x">']]) {
      expectMarkdown(test);
    }
  });

  it('escapes injections', function () {
    [
      [
        '[x<b>Bold</b>](https://evil.example.com)',
        '<a href="https://evil.example.com">x<b>Bold</b></a>',
      ],
      [
        '[x](https://evil.example.com"class="foo)',
        '<a href="https://evil.example.com%22class=%22foo">x</a>',
      ],
      [
        '[x](https://evil.example.com "class=\\"bar")',
        '<a title="class=&quot;bar" href="https://evil.example.com">x</a>',
      ],
    ].forEach(expectMarkdown);
    expect(sanitizedMarked('<script> <img <script> src=x onerror=alert(1) />')).toBe('');
  });

  it('allows custom html within code blocks', function () {
    expect(sanitizedMarked('```html\n<div>Hello</div>\n```')).toBe(
      `<pre><code class="language-html">&lt;div&gt;Hello&lt;/div&gt;\n</code></pre>\n`
    );
    expect(sanitizedMarked('```tsx\n<div>Hello</div>\n```')).toBe(
      `<pre><code class="language-tsx">&lt;div&gt;Hello&lt;/div&gt;\n</code></pre>\n`
    );
    expect(sanitizedMarked('```jsx\n<Component>Hello</Component>\n```')).toBe(
      `<pre><code class="language-jsx">&lt;Component&gt;Hello&lt;/Component&gt;\n</code></pre>\n`
    );
  });

  it('single line renderer should not render paragraphs', function () {
    expect(singleLineRenderer('foo')).toBe('foo');
    expect(sanitizedMarked('foo')).toBe('<p>foo</p>\n');
    expect(singleLineRenderer('Reading `file.py`')).toBe(`Reading <code>file.py</code>`);
    expect(sanitizedMarked('Reading `file.py`')).toBe(
      `<p>Reading <code>file.py</code></p>\n`
    );
  });

  it('escapes injections via asyncSanitizedMarked', async function () {
    const tests: Array<[string, string]> = [
      [
        '[x<b>Bold</b>](https://evil.example.com)',
        '<a href="https://evil.example.com">x<b>Bold</b></a>',
      ],
      [
        '[x](https://evil.example.com"class="foo)',
        '<a href="https://evil.example.com%22class=%22foo">x</a>',
      ],
      [
        '[x](https://evil.example.com "class=\\"bar")',
        '<a title="class=&quot;bar" href="https://evil.example.com">x</a>',
      ],
    ];
    for (const test of tests) {
      expect(await asyncSanitizedMarked(test[0])).toBe(`<p>${test[1]}</p>\n`);
    }
    expect(
      await asyncSanitizedMarked('<script> <img <script> src=x onerror=alert(1) />')
    ).toBe('');
  });

  it('does not render syntax highlighting via sanitizedMarked', function () {
    const markdown = '```javascript\nconst x = 1;\n```';
    expect(sanitizedMarked(markdown)).toBe(
      `<pre><code class="language-javascript">const x = 1;\n</code></pre>\n`
    );
  });

  it('renders syntax highlighting via asyncSanitizedMarked', async function () {
    const markdown = '```javascript\nconst x = 1;\n```';
    expect(await asyncSanitizedMarked(markdown)).toBe(
      `<pre><code class="language-javascript"><span class="token keyword">const</span> x <span class="token operator">=</span> <span class="token number">1</span><span class="token punctuation">;</span>\n</code></pre>`
    );
  });
});
