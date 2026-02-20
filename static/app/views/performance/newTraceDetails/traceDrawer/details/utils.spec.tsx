import {parseJsonWithFix} from './utils';

describe('parseJsonWithFix', () => {
  it('parses valid JSON without fixing', () => {
    const data = '{"name":"test","value":123}';
    const result = parseJsonWithFix(data);

    expect(result.fixedInvalidJson).toBe(false);
    expect(result.parsed).toEqual({name: 'test', value: 123});
  });

  it('fixes JSON truncated due to size limits mid-string', () => {
    const data = '{"message":"This is a very long message that got cut off du';
    const result = parseJsonWithFix(data);

    expect(result.fixedInvalidJson).toBe(true);
    expect(result.parsed).toEqual({
      message: 'This is a very long message that got cut off du~~',
    });
  });

  it('fixes JSON truncated due to size limits mid-array', () => {
    const data = '{"items":["item1","item2","item3","this is a very long ite';
    const result = parseJsonWithFix(data);

    expect(result.fixedInvalidJson).toBe(true);
    expect(result.parsed).toEqual({
      items: ['item1', 'item2', 'item3', 'this is a very long ite~~'],
    });
  });

  it('fixes truncations with ... marker', () => {
    const data =
      '[{"role":"user","content":"What is the capital?"},{"role":"assistant","content":"Paris is the capital of France. With an estimated population of 2,102,650 residents as of 1 January 2023...';
    const result = parseJsonWithFix(data);

    expect(result.fixedInvalidJson).toBe(true);
    expect(result.parsed).toEqual([
      {role: 'user', content: 'What is the capital?'},
      {
        role: 'assistant',
        content:
          'Paris is the capital of France. With an estimated population of 2,102,650 residents as of 1 January 2023...~~',
      },
    ]);
  });

  it('handles JSON with [Filtered] from data scrubbing', () => {
    const data = '[Filtered]';
    expect(() => parseJsonWithFix(data)).toThrow();
  });
});
