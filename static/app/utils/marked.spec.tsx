/* eslint no-script-url:0 */

import marked, {singleLineRenderer} from 'sentry/utils/marked';

function expectMarkdown(test: any) {
  expect(marked(test[0])).toEqual('<p>' + test[1] + '</p>\n');
}

describe('marked', function () {
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
    expect(marked('`foo`')).toBe('<p><code>foo</code></p>\n');
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
        '<a href="https://evil.example.com">xBold</a>',
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
    expect(marked('<script> <img <script> src=x onerror=alert(1) />')).toBe('');
  });

  it('single line renderer should not render paragraphs', function () {
    expect(singleLineRenderer('foo')).toBe('foo');
    expect(singleLineRenderer('Reading `file.py`')).toBe(`Reading <code>file.py</code>`);
    expect(marked('Reading `file.py`')).toBe(`<p>Reading <code>file.py</code></p>\n`);
    expect(marked('foo')).toBe('<p>foo</p>\n');
  });
});
