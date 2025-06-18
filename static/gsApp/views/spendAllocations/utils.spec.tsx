import {bigNumFormatter, BigNumUnits} from 'getsentry/views/spendAllocations/utils';

describe('Big Number Formatter', () => {
  it('formats small ints', () => {
    expect(bigNumFormatter(1)).toBe('1');
    expect(bigNumFormatter(500)).toBe('500');
    expect(bigNumFormatter(1, undefined, BigNumUnits.KILO_BYTES)).toBe('1 bytes');
    expect(bigNumFormatter(500, undefined, BigNumUnits.KILO_BYTES)).toBe('500 bytes');
  });
  it('formats thousands', () => {
    expect(bigNumFormatter(1000)).toBe('1K');
    expect(bigNumFormatter(1500)).toBe('1.5K');
    expect(bigNumFormatter(1520)).toBe('1.5K');
    expect(bigNumFormatter(1000, undefined, BigNumUnits.KILO_BYTES)).toBe('1KB');
  });
  it('formats millions', () => {
    expect(bigNumFormatter(1000000)).toBe('1M');
    expect(bigNumFormatter(1500000)).toBe('1.5M');
    expect(bigNumFormatter(1520000)).toBe('1.52M');
    expect(bigNumFormatter(1520000, 1)).toBe('1.5M');
    expect(bigNumFormatter(1520001)).toBe('1.52M');
    expect(bigNumFormatter(1020001)).toBe('1.02M');
    expect(bigNumFormatter(199999999)).toBe('199.99M');
    expect(bigNumFormatter(1000000, undefined, BigNumUnits.KILO_BYTES)).toBe('1MB');
    expect(bigNumFormatter(1520000, 1, BigNumUnits.KILO_BYTES)).toBe('1.5MB');
    expect(bigNumFormatter(1520000, undefined, BigNumUnits.KILO_BYTES)).toBe('1.52MB');
  });
  it('formats billions', () => {
    expect(bigNumFormatter(1000000000)).toBe('1B');
    expect(bigNumFormatter(1500000000)).toBe('1.5B');
    expect(bigNumFormatter(1520000000)).toBe('1.52B');
    expect(bigNumFormatter(1020001000)).toBe('1.02B');
    expect(bigNumFormatter(1000000000, undefined, BigNumUnits.KILO_BYTES)).toBe('1GB');
  });
});
