import {renderHook} from 'sentry-test/reactTestingLibrary';

import {usePrismTokensSourceContext} from 'sentry/components/events/interfaces/frame/usePrismTokensSourceContext';
import {loadPrismLanguage} from 'sentry/utils/prism';

jest.unmock('prismjs');

const defaultProps = {
  contextLines: [
    [10, 'function foo() {'],
    [11, "  return 'bar';"],
    [12, '}'],
  ] as Array<[number, string]>,
  lineNo: 11,
  fileExtension: 'js',
};

describe('usePrismTokensSourceContext', function () {
  beforeAll(async () => {
    // Loading languague up front makes tests run consistently
    await Promise.all([
      loadPrismLanguage('javascript', {}),
      loadPrismLanguage('python', {}),
      loadPrismLanguage('perl', {}),
    ]);
  });

  it('splits tokens by line (normal case)', function () {
    const {result} = renderHook(usePrismTokensSourceContext, {
      initialProps: defaultProps,
    });
    const lines = result.current;
    expect(lines).toHaveLength(3);

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
      {children: 'return', className: 'token keyword'},
      {children: ' ', className: 'token'},
      {children: "'bar'", className: 'token string'},
      {children: ';', className: 'token punctuation'},
    ]);

    expect(lines[2]).toEqual([{children: '}', className: 'token punctuation'}]);
  });

  it('fixes broken block comment at start of context', function () {
    const {result} = renderHook(usePrismTokensSourceContext, {
      initialProps: {
        ...defaultProps,
        contextLines: [
          [8, 'some comment text'],
          [9, '*/'],
          [10, 'function foo() {'],
          [11, "  return 'bar';"],
          [12, '}'],
        ] as Array<[number, string]>,
        lineNo: 11,
      },
    });
    const lines = result.current;
    expect(lines).toHaveLength(5);

    expect(lines[0]).toEqual([
      {children: 'some comment text', className: 'token comment'},
    ]);
    expect(lines[1]).toEqual([{children: '*/', className: 'token comment'}]);

    expect(lines[2]).toEqual([
      {children: 'function', className: 'token keyword'},
      {children: ' ', className: 'token'},
      {children: 'foo', className: 'token function'},
      {children: '(', className: 'token punctuation'},
      {children: ')', className: 'token punctuation'},
      {children: ' ', className: 'token'},
      {children: '{', className: 'token punctuation'},
    ]);

    expect(lines[3]).toEqual([
      {children: '  ', className: 'token'},
      {children: 'return', className: 'token keyword'},
      {children: ' ', className: 'token'},
      {children: "'bar'", className: 'token string'},
      {children: ';', className: 'token punctuation'},
    ]);

    expect(lines[4]).toEqual([{children: '}', className: 'token punctuation'}]);
  });

  it('fixes broken block comment at end of context', function () {
    const {result} = renderHook(usePrismTokensSourceContext, {
      initialProps: {
        ...defaultProps,
        contextLines: [
          [10, 'function foo() {'],
          [11, "  return 'bar';"],
          [12, '}'],
          [13, '/*'],
          [12, 'some comment text'],
        ] as Array<[number, string]>,
        lineNo: 11,
      },
    });
    const lines = result.current;
    expect(lines).toHaveLength(5);

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
      {children: 'return', className: 'token keyword'},
      {children: ' ', className: 'token'},
      {children: "'bar'", className: 'token string'},
      {children: ';', className: 'token punctuation'},
    ]);

    expect(lines[2]).toEqual([{children: '}', className: 'token punctuation'}]);

    expect(lines[3]).toEqual([{children: '/*', className: 'token comment'}]);
    expect(lines[4]).toEqual([
      {children: 'some comment text', className: 'token comment'},
    ]);
  });

  it('fixes broken block comment at beginning and end of context', function () {
    const {result} = renderHook(usePrismTokensSourceContext, {
      initialProps: {
        ...defaultProps,
        contextLines: [
          [8, 'some comment text'],
          [9, '*/'],
          [10, 'function foo() {'],
          [11, "  return 'bar';"],
          [12, '}'],
          [13, '/*'],
          [12, 'some comment text'],
        ] as Array<[number, string]>,
        lineNo: 11,
      },
    });
    const lines = result.current;
    expect(lines).toHaveLength(7);

    expect(lines[0]).toEqual([
      {children: 'some comment text', className: 'token comment'},
    ]);
    expect(lines[1]).toEqual([{children: '*/', className: 'token comment'}]);

    expect(lines[2]).toEqual([
      {children: 'function', className: 'token keyword'},
      {children: ' ', className: 'token'},
      {children: 'foo', className: 'token function'},
      {children: '(', className: 'token punctuation'},
      {children: ')', className: 'token punctuation'},
      {children: ' ', className: 'token'},
      {children: '{', className: 'token punctuation'},
    ]);

    expect(lines[3]).toEqual([
      {children: '  ', className: 'token'},
      {children: 'return', className: 'token keyword'},
      {children: ' ', className: 'token'},
      {children: "'bar'", className: 'token string'},
      {children: ';', className: 'token punctuation'},
    ]);

    expect(lines[4]).toEqual([{children: '}', className: 'token punctuation'}]);

    expect(lines[5]).toEqual([{children: '/*', className: 'token comment'}]);
    expect(lines[6]).toEqual([
      {children: 'some comment text', className: 'token comment'},
    ]);
  });

  it('does not modify highlighting when block comment is fully formed', function () {
    const {result} = renderHook(usePrismTokensSourceContext, {
      initialProps: {
        ...defaultProps,
        contextLines: [
          [8, 'const a = b;'],
          [9, '/* some comment text */'],
          [10, 'function foo() {'],
          [11, "  return 'bar';"],
          [12, '}'],
        ] as Array<[number, string]>,
        lineNo: 11,
      },
    });
    const lines = result.current;
    expect(lines).toHaveLength(5);

    // First line highlights keywords as expected
    expect(lines[0]).toEqual([
      {children: 'const', className: 'token keyword'},
      {children: ' a ', className: 'token'},
      {children: '=', className: 'token operator'},
      {children: ' b', className: 'token'},
      {children: ';', className: 'token punctuation'},
    ]);
    // Fully-formed comment is highlighted as such
    expect(lines[1]).toEqual([
      {children: '/* some comment text */', className: 'token comment'},
    ]);

    // Rest of code is highlighted normally
    expect(lines[2]).toEqual([
      {children: 'function', className: 'token keyword'},
      {children: ' ', className: 'token'},
      {children: 'foo', className: 'token function'},
      {children: '(', className: 'token punctuation'},
      {children: ')', className: 'token punctuation'},
      {children: ' ', className: 'token'},
      {children: '{', className: 'token punctuation'},
    ]);

    expect(lines[3]).toEqual([
      {children: '  ', className: 'token'},
      {children: 'return', className: 'token keyword'},
      {children: ' ', className: 'token'},
      {children: "'bar'", className: 'token string'},
      {children: ';', className: 'token punctuation'},
    ]);

    expect(lines[4]).toEqual([{children: '}', className: 'token punctuation'}]);
  });

  it('does not mistake comment terminators within strings as comments', function () {
    const {result} = renderHook(usePrismTokensSourceContext, {
      initialProps: {
        ...defaultProps,
        contextLines: [
          [9, 'const str = "*/";'],
          [10, 'function foo() {'],
          [11, "  return 'bar';"],
          [12, '}'],
        ] as Array<[number, string]>,
        lineNo: 11,
      },
    });
    const lines = result.current;
    expect(lines).toHaveLength(4);

    expect(lines[0]).toEqual([
      {children: 'const', className: 'token keyword'},
      {children: ' str ', className: 'token'},
      {children: '=', className: 'token operator'},
      {children: ' ', className: 'token'},
      {children: '"*/"', className: 'token string'},
      {children: ';', className: 'token punctuation'},
    ]);

    expect(lines[1]).toEqual([
      {children: 'function', className: 'token keyword'},
      {children: ' ', className: 'token'},
      {children: 'foo', className: 'token function'},
      {children: '(', className: 'token punctuation'},
      {children: ')', className: 'token punctuation'},
      {children: ' ', className: 'token'},
      {children: '{', className: 'token punctuation'},
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

  describe('other languages', function () {
    it('python: fixes open syntax at start and end', function () {
      const {result} = renderHook(usePrismTokensSourceContext, {
        initialProps: {
          ...defaultProps,
          contextLines: [
            [8, 'some comment text'],
            [9, '"""'],
            [10, 'a = "10"'],
            [11, 'print("blah")'],
            [12, 'b = "20"'],
            [13, "'''"],
            [14, 'some comment text'],
          ] as Array<[number, string]>,
          lineNo: 11,
          fileExtension: 'py',
        },
      });
      const lines = result.current;

      expect(lines).toEqual([
        [{children: 'some comment text', className: 'token triple-quoted-string string'}],
        [{children: '"""', className: 'token triple-quoted-string string'}],
        [
          {children: 'a ', className: 'token'},
          {children: '=', className: 'token operator'},
          {children: ' ', className: 'token'},
          {children: '"10"', className: 'token string'},
        ],
        [
          {children: 'print', className: 'token keyword'},
          {children: '(', className: 'token punctuation'},
          {children: '"blah"', className: 'token string'},
          {children: ')', className: 'token punctuation'},
        ],
        [
          {children: 'b ', className: 'token'},
          {children: '=', className: 'token operator'},
          {children: ' ', className: 'token'},
          {children: '"20"', className: 'token string'},
        ],
        [{children: "'''", className: 'token triple-quoted-string string'}],
        [{children: 'some comment text', className: 'token triple-quoted-string string'}],
      ]);
    });

    it('perl: fixes open syntax at start and end', function () {
      const {result} = renderHook(usePrismTokensSourceContext, {
        initialProps: {
          ...defaultProps,
          contextLines: [
            [8, 'some comment text'],
            [9, '=cut'],
            [10, '$a = 10;'],
            [11, 'print "blah";'],
            [12, '$b = 20;'],
            [13, '=comment'],
            [14, 'some comment text'],
          ] as Array<[number, string]>,
          lineNo: 11,
          fileExtension: 'pl',
        },
      });
      const lines = result.current;

      expect(lines).toEqual([
        [{children: 'some comment text', className: 'token comment'}],
        [{children: '=cut', className: 'token comment'}],
        [
          {children: '$a', className: 'token variable'},
          {children: ' ', className: 'token'},
          {children: '=', className: 'token operator'},
          {children: ' ', className: 'token'},
          {children: '10', className: 'token number'},
          {children: ';', className: 'token punctuation'},
        ],
        [
          {children: 'print', className: 'token keyword'},
          {children: ' ', className: 'token'},
          {children: '"blah"', className: 'token string'},
          {children: ';', className: 'token punctuation'},
        ],
        [
          {children: '$b', className: 'token variable'},
          {children: ' ', className: 'token'},
          {children: '=', className: 'token operator'},
          {children: ' ', className: 'token'},
          {children: '20', className: 'token number'},
          {children: ';', className: 'token punctuation'},
        ],
        [{children: '=comment', className: 'token comment'}],
        [{children: 'some comment text', className: 'token comment'}],
      ]);
    });
  });
});
