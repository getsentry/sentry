import toPixels from 'sentry/utils/number/toPixels';

describe('toPixels', () => {
  it('should convert a number to a string suffixed with px', () => {
    expect(toPixels(12)).toBe('12px');
  });

  it('should leave a string alone and return it', () => {
    expect(toPixels('12px')).toBe('12px');
    expect(toPixels('100%')).toBe('100%');
    expect(toPixels('1em')).toBe('1em');
  });

  it('should return undefined if that was passed in', () => {
    expect(toPixels(undefined)).toBeUndefined();
  });
});
