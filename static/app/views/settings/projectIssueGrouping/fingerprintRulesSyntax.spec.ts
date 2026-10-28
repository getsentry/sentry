import {tokenizeFingerprintRules} from 'sentry/views/settings/projectIssueGrouping/fingerprintRulesSyntax';

function getTokens(text: string) {
  return tokenizeFingerprintRules(text).tokens.map(({type, start, end}) => [
    type,
    text.slice(start, end),
  ]);
}

function getDiagnostics(text: string) {
  return tokenizeFingerprintRules(text).diagnostics.map(({code, start, end}) => [
    code,
    text.slice(start, end),
  ]);
}

describe('tokenizeFingerprintRules', () => {
  it('tokenizes each part of a rule', () => {
    expect(
      getTokens(
        '# comment\n!error.type:"My Error" tags.a:b* -> x, {{ default }} "{{ logger }}" title="T {{ logger }}"'
      )
    ).toEqual([
      ['comment', '# comment'],
      ['negation', '!'],
      ['matcher', 'error.type'],
      ['punctuation', ':'],
      ['pattern', '"My Error"'],
      ['matcher', 'tags.a'],
      ['punctuation', ':'],
      ['pattern', 'b*'],
      ['arrow', '->'],
      ['value', 'x'],
      ['punctuation', ','],
      ['variable', '{{ default }}'],
      ['variable', '"{{ logger }}"'],
      ['attribute', 'title'],
      ['punctuation', '='],
      ['string', '"T '],
      ['variable', '{{ logger }}'],
      ['string', '"'],
    ]);
  });

  it.each([
    'error.type:DatabaseUnavailable -> system-down',
    'stack.function:malloc -> memory-allocation-error\r\n\r\n# comment',
    'message:"a -> b" -> arrow',
    'message:a->b -> literal-arrow-in-pattern',
    '"error.type":A -> a,',
    'error.type:A -> title="only a title"',
    'message:"x → y" -> a',
    'message:"multi\\"quote" -> {{ tags.foo }}',
    // Names are checked by the backend on save
    'error.typo:A -> {{ x }}, name="y"',
    // Not whitespace to the backend
    'message:a -> x\uFEFFy',
  ])('has no diagnostics for %j', text => {
    expect(getDiagnostics(text)).toEqual([]);
  });

  it.each([
    ['error.type:A => a', 'lookalike-arrow', '=>'],
    ['error.type:A-> a', 'glued-arrow', '->'],
    ['error.type:A → a', 'lookalike-arrow', '→'],
    ['error.type:A→ a', 'lookalike-arrow', '→'],
    ['error.type:A a', 'missing-arrow', 'error.type:A a'],
    ['message:"a=>b" x', 'missing-arrow', 'message:"a=>b" x'],
    ...[
      'error.type A -> a',
      'error.type: A -> a',
      'error.type:A ->',
      '-> a',
      'error.type:A\t-> a',
      'error.type:A\x85-> a',
      'error.type:A -> a,,b',
      'error.type:A -> {x}',
    ].map(line => [line, 'invalid-syntax', line]),
    ['error.type:A -> a title=T', 'unquoted-title', 'title=T'],
    ['error.type:A -> a # b c', 'inline-comment', '# b c'],
  ])('flags %j', (text, code, highlighted) => {
    expect(getDiagnostics(text)).toEqual([[code, highlighted]]);
  });
});
