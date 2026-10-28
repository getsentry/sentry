import {tokenizeFingerprintRules} from 'sentry/views/settings/projectIssueGrouping/fingerprintRulesSyntax';

function getTokens(text: string) {
  return tokenizeFingerprintRules(text).tokens.map(({type, start, end}) => [
    type,
    text.slice(start, end),
  ]);
}

function getDiagnostics(text: string) {
  return tokenizeFingerprintRules(text).diagnostics.map(
    ({code, severity, start, end}) => [code, severity, text.slice(start, end)]
  );
}

describe('tokenizeFingerprintRules', () => {
  it('tokenizes each part of a rule', () => {
    expect(
      getTokens(
        '# comment\n!error.type:"My Error" tags.a:b* -> x, {{ default }} title="T {{ logger }}"'
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
      ['attribute', 'title'],
      ['punctuation', '='],
      ['string', '"T '],
      ['variable', '{{ logger }}'],
      ['string', '"'],
    ]);
  });

  it('treats a quoted variable as a variable', () => {
    expect(getTokens('message:a -> "{{ logger }}"')).toContainEqual([
      'variable',
      '"{{ logger }}"',
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
  ])('has no diagnostics for %j', text => {
    expect(getDiagnostics(text)).toEqual([]);
  });

  it.each([
    ['error.type:A => a', 'lookalike-arrow', 'error', '=>'],
    ['error.type:A-> a', 'glued-arrow', 'error', '->'],
    ['error.type:A → a', 'lookalike-arrow', 'error', '→'],
    ['error.type:A→ a', 'lookalike-arrow', 'error', '→'],
    ['error.type:A a', 'missing-arrow', 'error', 'error.type:A a'],
    ['error.type:A', 'missing-arrow', 'error', 'error.type:A'],
    ['error.type A -> a', 'invalid-syntax', 'error', 'error.type'],
    ['error.type: A -> a', 'invalid-syntax', 'error', 'error.type:'],
    ['error.type:A ->', 'invalid-syntax', 'error', '->'],
    ['-> a', 'invalid-syntax', 'error', '->'],
    ['error.type:A\t-> a', 'invalid-syntax', 'error', '\t'],
    ['error.type:A -> a,,b', 'invalid-syntax', 'error', ','],
    ['error.type:A -> {x}', 'invalid-syntax', 'error', '{x}'],
    ['error.typo:A -> a', 'unknown-matcher', 'error', 'error.typo'],
    ['error.type:A -> name="x"', 'unknown-attribute', 'error', 'name'],
    ['error.type:A -> {{ x }}', 'unknown-variable', 'warning', '{{ x }}'],
    [
      'error.type:A -> a title="{{ default }}"',
      'unknown-variable',
      'warning',
      '{{ default }}',
    ],
    ['error.type:A -> a title=T', 'unquoted-title', 'warning', 'title=T'],
    ['error.type:A -> a # b c', 'inline-comment', 'warning', '# b c'],
    [
      'message:"a -> a\nmessage:"b" -> b',
      'multiline-quote',
      'warning',
      '"a -> a\nmessage:"',
    ],
  ])('flags %j', (text, code, severity, highlighted) => {
    expect(getDiagnostics(text)).toContainEqual([code, severity, highlighted]);
  });

  it('reports a rule without an arrow once', () => {
    expect(getDiagnostics('this is not a rule')).toEqual([
      ['missing-arrow', 'error', 'this is not a rule'],
    ]);
  });

  it('keeps tokens in order without overlapping', () => {
    const {tokens} = tokenizeFingerprintRules(
      'error.type:"a\nb"c:d-> x\n!e: f -> {{ g }}, title="{{ h }}" # i'
    );
    for (let i = 1; i < tokens.length; i++) {
      expect(tokens[i]!.start).toBeGreaterThanOrEqual(tokens[i - 1]!.end);
    }
  });
});
