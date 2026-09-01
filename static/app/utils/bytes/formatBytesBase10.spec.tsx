import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';

describe('formatBytesBase10', () => {
  it('formats bytes below the threshold', () => {
    expect(formatBytesBase10(0)).toBe('0 B');
    expect(formatBytesBase10(999)).toBe('999 B');
  });

  it('scales up through the units', () => {
    expect(formatBytesBase10(1000)).toBe('1 kB');
    expect(formatBytesBase10(1000 ** 2)).toBe('1 MB');
    expect(formatBytesBase10(1000 ** 3)).toBe('1 GB');
    expect(formatBytesBase10(1000 ** 4)).toBe('1 TB');
    expect(formatBytesBase10(1000 ** 5)).toBe('1 PB');
    expect(formatBytesBase10(1000 ** 6)).toBe('1 EB');
    expect(formatBytesBase10(1000 ** 7)).toBe('1 ZB');
    expect(formatBytesBase10(1000 ** 8)).toBe('1 YB');
  });

  it('rounds to two decimal points without trailing zeros', () => {
    expect(formatBytesBase10(1234)).toBe('1.23 kB');
    expect(formatBytesBase10(1200)).toBe('1.2 kB');
  });

  it('formats negative values with a leading minus sign', () => {
    expect(formatBytesBase10(-999)).toBe('-999 B');
  });

  it('respects the starting unit offset', () => {
    expect(formatBytesBase10(1, 1)).toBe('1 kB');
    expect(formatBytesBase10(1000, 1)).toBe('1 MB');
    expect(formatBytesBase10(-1500, 2)).toBe('-1.5 GB');
  });
});
