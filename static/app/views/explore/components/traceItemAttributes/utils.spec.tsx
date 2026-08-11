import {isNumericAttribute} from 'sentry/views/explore/components/traceItemAttributes/utils';

describe('isNumericAttribute', () => {
  it('returns true for explicit int/float types', () => {
    expect(isNumericAttribute({value: '42', type: 'int'})).toBe(true);
    expect(isNumericAttribute({value: '3.14', type: 'float'})).toBe(true);
  });

  it('returns true for tags[name,number] keys', () => {
    expect(
      isNumericAttribute({
        value: '100',
        type: 'str',
        key: 'tags[code.line.number,number]',
      })
    ).toBe(true);
  });

  it('returns true for JS number values as a fallback', () => {
    expect(isNumericAttribute({value: 42, type: 'str'})).toBe(true);
  });

  it('returns false for null, bool, and plain strings', () => {
    expect(isNumericAttribute({value: null, type: 'int'})).toBe(false);
    expect(isNumericAttribute({value: 'true', type: 'bool'})).toBe(false);
    expect(isNumericAttribute({value: 'hello', type: 'str', key: 'message'})).toBe(false);
  });
});
