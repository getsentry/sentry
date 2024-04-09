import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {loadPrismLanguage} from 'sentry/utils/prism';
import {usePrismTokens} from 'sentry/utils/usePrismTokens';

jest.unmock('prismjs');

const JS_CODE = `function foo() {
  // Returns 'bar'
  return 'bar';
}`;

const SINGLE_LINE_CODE = `const a='b'`;

const NESTED_CODE = `<p class="hey">Test</p>`;

describe('usePrismTokens', () => {
  beforeAll(async () => {
    // Loading all languagues up front makes tests run consistently
    await loadPrismLanguage('javascript', {});
    await loadPrismLanguage('html', {});
  });

  it('splits tokens by line', () => {
    const {result} = reactHooks.renderHook(usePrismTokens, {
      initialProps: {code: JS_CODE, language: 'javascript'},
    });
    const lines = result.current;
    expect(lines).toHaveLength(4);

    expect(lines[0]).toEqual([
      {children: 'function', className: 'token keyword'},
      {children: ' ', className: 'token'},
      {children: 'foo', className: 'token function'},
      {children: '(', className: 'token punctuation'},
      {children: ')', className: 'token punctuation'},
      {children: ' ', className: 'token'},
      {children: '{', className: 'token punctuation'},
    ]);

    expect(lines[1]).toEqual([
      {children: '  ', className: 'token'},
      {children: "// Returns 'bar'", className: 'token comment'},
    ]);

    expect(lines[2]).toEqual([
      {children: '  ', className: 'token'},
      {children: 'return', className: 'token keyword'},
      {children: ' ', className: 'token'},
      {children: "'bar'", className: 'token string'},
      {children: ';', className: 'token punctuation'},
    ]);

    expect(lines[3]).toEqual([{children: '}', className: 'token punctuation'}]);
  });

  it('works with single line of code', () => {
    const {result} = reactHooks.renderHook(usePrismTokens, {
      initialProps: {code: SINGLE_LINE_CODE, language: 'javascript'},
    });
    const lines = result.current;

    expect(lines).toEqual([
      [
        {children: 'const', className: 'token keyword'},
        {children: ' a', className: 'token'},
        {children: '=', className: 'token operator'},
        {children: "'b'", className: 'token string'},
      ],
    ]);
  });

  it('falls back when no grammar is available', () => {
    jest.spyOn(console, 'warn').mockImplementation();

    const {result} = reactHooks.renderHook(usePrismTokens, {
      initialProps: {code: JS_CODE, language: 'not-a-language'},
    });
    const lines = result.current;

    expect(lines).toEqual([
      [{children: 'function foo() {', className: 'token'}],
      [{children: "  // Returns 'bar'", className: 'token'}],
      [{children: "  return 'bar';", className: 'token'}],
      [{children: '}', className: 'token'}],
    ]);
  });

  it('works with nested tokens', () => {
    const {result} = reactHooks.renderHook(usePrismTokens, {
      initialProps: {code: NESTED_CODE, language: 'html'},
    });
    const lines = result.current;

    expect(lines).toEqual([
      [
        {children: '<', className: 'token tag punctuation'},
        {children: 'p', className: 'token tag'},
        {children: ' ', className: 'token tag'},
        {children: 'class', className: 'token tag attr-name'},
        {children: '=', className: 'token tag attr-value punctuation attr-equals'},
        {children: '"', className: 'token tag attr-value punctuation'},
        {children: 'hey', className: 'token tag attr-value'},
        {children: '"', className: 'token tag attr-value punctuation'},
        {children: '>', className: 'token tag punctuation'},
        {children: 'Test', className: 'token'},
        {children: '</', className: 'token tag punctuation'},
        {children: 'p', className: 'token tag'},
        {children: '>', className: 'token tag punctuation'},
      ],
    ]);
  });
});
