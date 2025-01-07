/* eslint no-script-url:0 */

import marked, {limitedMarked} from 'sentry/utils/marked';

function expectMarkdown(test) {
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
        '<a href="https://example.com" title="Example Title">x</a>',
      ],
    ]) {
      expectMarkdown(test);
    }
  });

  it('rejected links should be rendered as plain text', function () {
    for (const test of [
      ['[x](javascript:foo)', 'javascript:foo'],
      ['[x](java\nscript:foo)', '[x](java\nscript:foo)'],
      ['[x](data:foo)', 'data:foo'],
      ['[x](vbscript:foo)', 'vbscript:foo'],
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
    for (const test of [['![x](javascript:foo)', '']]) {
      expectMarkdown(test);
    }
  });

  it('escapes injections', function () {
    [
      [
        '[x<b>Bold</b>](https://evil.example.com)',
        '<a href="https://evil.example.com">x&lt;b&gt;Bold&lt;/b&gt;</a>',
      ],
      [
        '[x](https://evil.example.com"class="foo)',
        '<a href="https://evil.example.com%22class=%22foo">x</a>',
      ],
      [
        '[x](https://evil.example.com "class=\\"bar")',
        '<a href="https://evil.example.com" title="class=&quot;bar">x</a>',
      ],
      [
        '<script> <img <script> src=x onerror=alert(1) />',
        '&lt;script&gt; &lt;img &lt;script&gt; src=x onerror=alert(1) /&gt;',
      ],
    ].forEach(expectMarkdown);
  });

  it('limited renderer does not render images and hyperlinks as html', function () {
    for (const test of [
      ['![alt](http://example.com/rick.gif)', 'http://example.com/rick.gif'],
      ['[click me](http://example.com)', 'http://example.com'],
    ]) {
      expect(limitedMarked(test[0]!)).toEqual('<p>' + test[1] + '</p>\n');
    }
  });
});
