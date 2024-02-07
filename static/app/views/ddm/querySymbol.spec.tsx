import {getQuerySymbol} from 'sentry/views/ddm/querySymbol';

describe('getQuerySymbol', () => {
  it('should return the correct symbol', () => {
    expect(getQuerySymbol(0)).toBe('A');
    expect(getQuerySymbol(1)).toBe('B');
    expect(getQuerySymbol(25)).toBe('Z');
    expect(getQuerySymbol(26)).toBe('AA');
    expect(getQuerySymbol(27)).toBe('AB');
    expect(getQuerySymbol(52)).toBe('BA');
    expect(getQuerySymbol(53)).toBe('BB');
    expect(getQuerySymbol(77)).toBe('BZ');
    expect(getQuerySymbol(78)).toBe('CA');
    expect(getQuerySymbol(702)).toBe('AAA');
  });
});
