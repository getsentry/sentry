/*eslint no-script-url:0*/

import marked from 'app/utils/marked';

function expectMarkdown(test) {
  expect(marked(test[0])).toEqual('<p>' + test[1] + '</p>\n');
}

describe('marked', function() {
  it('normal links get rendered as html', function() {
    for (const test of [
      ['[x](http://example.com)', '<a href="http://example.com">x</a>'],
      ['[x](https://example.com)', '<a href="https://example.com">x</a>'],
      ['[x](mailto:foo@example.com)', '<a href="mailto:foo@example.com">x</a>'],
    ]) {
      expectMarkdown(test);
    }
  });

  it('rejected links should be rendered as plain text', function() {
    for (const test of [
      ['[x](javascript:foo)', 'javascript:foo'],
      ['[x](java\nscript:foo)', '[x](java\nscript:foo)'],
      ['[x](data:foo)', 'data:foo'],
      ['[x](vbscript:foo)', 'vbscript:foo'],
    ]) {
      expectMarkdown(test);
    }
  });

  it('normal images get rendered as html', function() {
    for (const test of [
      ['![](http://example.com)', '<img alt="" src="http://example.com">'],
      ['![x](http://example.com)', '<img alt="x" src="http://example.com">'],
      ['![x](https://example.com)', '<img alt="x" src="https://example.com">'],
    ]) {
      expectMarkdown(test);
    }
  });

  it("rejected images shouldn't be rendered at all", function() {
    for (const test of [['![x](javascript:foo)', '']]) {
      expectMarkdown(test);
    }
  });

  it('escapes XSS and removes invalid attributes on img', function() {
    [
      [
        `[test](http://example.com\""#><img/onerror='alert\(location\)'/src=>)
![test](http://example.com"/onerror='alert\(location\)'/)`,
        `<a href="http://example.com"><img src="">"&gt;test</a>
<img alt="test" src="http://example.com">`,
      ],
      [
        '<script> <img <script> src=x onerror=alert(1) />',
        '&lt;script&gt; &lt;img &lt;script&gt; src=x onerror=alert(1) /&gt;',
      ],
    ].forEach(expectMarkdown);
  });
});
