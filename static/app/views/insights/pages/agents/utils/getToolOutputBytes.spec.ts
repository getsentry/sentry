import {getToolOutputBytesFromAttributes} from './getToolOutputBytes';

describe('getToolOutputBytesFromAttributes', () => {
  it.each([4096, 0, '4096', '0'])('prefers reported size %p over the result', size => {
    const attributes: Record<string, string | number> = {
      'gen_ai.tool.call.result.size': size,
      'gen_ai.tool.call.result': 'truncated result',
    };
    const getAttribute = jest.fn((key: string) => attributes[key]);

    expect(getToolOutputBytesFromAttributes(getAttribute)).toBe(Number(size));
    expect(getAttribute).toHaveBeenCalledTimes(1);
  });

  it('uses the reported size without a result', () => {
    expect(
      getToolOutputBytesFromAttributes(key =>
        key === 'gen_ai.tool.call.result.size' ? 2048 : undefined
      )
    ).toBe(2048);
  });

  it.each(['gen_ai.tool.call.result', 'gen_ai.tool.output'])(
    'falls back to the UTF-8 byte length of %s',
    field => {
      expect(
        getToolOutputBytesFromAttributes(key => (key === field ? 'héllo 🌍' : undefined))
      ).toBe(11);
    }
  );

  it.each([null, '', 'abc', -1])('ignores an unusable reported size %p', size => {
    const attributes: Record<string, string | number | null> = {
      'gen_ai.tool.call.result.size': size,
      'gen_ai.tool.call.result': 'abc',
    };
    expect(getToolOutputBytesFromAttributes(key => attributes[key])).toBe(3);
  });

  it('prefers the standard result over the legacy output', () => {
    const attributes: Record<string, string> = {
      'gen_ai.tool.call.result': 'abc',
      'gen_ai.tool.output': 'longer output',
    };
    expect(getToolOutputBytesFromAttributes(key => attributes[key])).toBe(3);
  });

  it('returns zero when no output or size is available', () => {
    const attributes: Record<string, string> = {};
    expect(getToolOutputBytesFromAttributes(key => attributes[key])).toBe(0);
  });
});
