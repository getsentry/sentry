/*eslint no-script-url:0*/

import marked from 'app/utils/marked';

function expectMarkdown(test) {
  expect(marked(test[0])).to.eql('<p>' + test[1] + '</p>\n');
}

describe('marked', function () {
  it('normal links get rendered as html', function () {
    for (let test of [
      ['[x](http://example.com)', '<a href="http://example.com">x</a>'],
      ['[x](https://example.com)', '<a href="https://example.com">x</a>'],
      ['[x](mailto:foo@example.com)', '<a href="mailto:foo@example.com">x</a>'],
    ]) {
      expectMarkdown(test);
    }
  });

  it('rejected links should be rendered as plain text', function () {
    for (let test of [
      ['[x](javascript:foo)', 'javascript:foo'],
      ['[x](data:foo)', 'data:foo'],
      ['[x](vbscript:foo)', 'vbscript:foo'],
    ]) {
      expectMarkdown(test);
    }
  });

  it('normal images get rendered as html', function () {
    for (let test of [
      ['![](http://example.com)', '<img src="http://example.com" alt="">'],
      ['![x](http://example.com)', '<img src="http://example.com" alt="x">'],
      ['![x](https://example.com)', '<img src="https://example.com" alt="x">'],
    ]) {
      expectMarkdown(test);
    }
  });

  it('rejected images shouldn\'t be rendered at all', function() {
    for (let test of [
      ['![x](javascript:foo)', ''],
    ]) {
      expectMarkdown(test);
    }
  });
});
