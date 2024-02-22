import {getQuerySymbol} from 'sentry/views/ddm/querySymbol';

describe('getQuerySymbol', () => {
  it('should return the correct symbol', () => {
    expect(getQuerySymbol(0)).toBe('a');
    expect(getQuerySymbol(1)).toBe('b');
    expect(getQuerySymbol(25)).toBe('z');
    expect(getQuerySymbol(26)).toBe('aa');
    expect(getQuerySymbol(27)).toBe('ab');
    expect(getQuerySymbol(52)).toBe('ba');
    expect(getQuerySymbol(53)).toBe('bb');
    expect(getQuerySymbol(77)).toBe('bz');
    expect(getQuerySymbol(78)).toBe('ca');
    expect(getQuerySymbol(702)).toBe('aaa');
  });
});
