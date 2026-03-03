import {transformPartsMessages} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiInput';

describe('transformPartsMessages', () => {
  it('returns the transformed messages for a valid parts-format input', () => {
    const input = JSON.stringify([
      {
        role: 'user',
        parts: [{type: 'text', content: 'Hello, world!'}],
      },
      {
        role: 'assistant',
        parts: [{type: 'text', text: 'Hi there!'}],
      },
    ]);

    const {result, fixedInvalidJson} = transformPartsMessages(input);

    expect(fixedInvalidJson).toBe(false);
    expect(JSON.parse(result!)).toEqual([
      {role: 'user', content: 'Hello, world!'},
      {role: 'assistant', content: 'Hi there!'},
    ]);
  });

  it('concatenates multiple text parts within a single message', () => {
    const input = JSON.stringify([
      {
        role: 'user',
        parts: [
          {type: 'text', text: 'First part.'},
          {type: 'text', text: 'Second part.'},
        ],
      },
    ]);

    const {result} = transformPartsMessages(input);

    expect(JSON.parse(result!)).toEqual([
      {role: 'user', content: 'First part.\nSecond part.'},
    ]);
  });

  it('returns {result: undefined} when the top-level value is not an array', () => {
    const input = JSON.stringify({role: 'user', content: 'not an array'});
    const {result, fixedInvalidJson} = transformPartsMessages(input);

    expect(result).toBeUndefined();
    expect(fixedInvalidJson).toBe(false);
  });

  it('does not throw when the entire value is [Filtered]', () => {
    expect(() => transformPartsMessages('[Filtered]')).not.toThrow();

    const {result, fixedInvalidJson} = transformPartsMessages('[Filtered]');
    expect(result).toBeUndefined();
    expect(fixedInvalidJson).toBe(true);
  });

  it('does not throw when [Filtered] appears inside a JSON message array', () => {
    const input = '[{"role":"user","content":[Filtered]}]';
    expect(() => transformPartsMessages(input)).not.toThrow();

    const {result, fixedInvalidJson} = transformPartsMessages(input);
    expect(result).toBeUndefined();
    expect(fixedInvalidJson).toBe(true);
  });

  it('does not throw when [Filtered] appears in a nested field', () => {
    const input = '[{"role":"assistant","parts":[{"type":"text","text":[Filtered]}]}]';
    expect(() => transformPartsMessages(input)).not.toThrow();
  });

  it('does not throw when the JSON contains an invalid escape sequence', () => {
    const input = '{"message":"contains bad \\p escape"}';
    expect(() => transformPartsMessages(input)).not.toThrow();

    const {result, fixedInvalidJson} = transformPartsMessages(input);
    expect(result).toBeUndefined();
    expect(fixedInvalidJson).toBe(true);
  });

  it('does not throw for a truncated JSON that fixJson cannot repair', () => {
    const input = '[{"role":"user","content":"hello \\';
    expect(() => transformPartsMessages(input)).not.toThrow();
  });
});
