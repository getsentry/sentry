import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';

describe('formatBytesBase2', () => {
  it('formats bytes below the threshold', () => {
    expect(formatBytesBase2(0)).toBe('0.0 B');
    expect(formatBytesBase2(1023)).toBe('1023.0 B');
  });

  it('scales up through the units', () => {
    expect(formatBytesBase2(1024)).toBe('1.0 KiB');
    expect(formatBytesBase2(1024 ** 2)).toBe('1.0 MiB');
    expect(formatBytesBase2(1024 ** 3)).toBe('1.0 GiB');
    expect(formatBytesBase2(1024 ** 4)).toBe('1.0 TiB');
    expect(formatBytesBase2(1024 ** 5)).toBe('1.0 PiB');
    expect(formatBytesBase2(1024 ** 6)).toBe('1.0 EiB');
    expect(formatBytesBase2(1024 ** 7)).toBe('1.0 ZiB');
    expect(formatBytesBase2(1024 ** 8)).toBe('1.0 YiB');
  });

  it('honors the fixPoints argument', () => {
    expect(formatBytesBase2(1536, 0)).toBe('2 KiB');
    expect(formatBytesBase2(1536, 3)).toBe('1.500 KiB');
  });

  it('uses dynamic decimal points when fixPoints is false', () => {
    expect(formatBytesBase2(1024, false)).toBe('1 KiB');
    expect(formatBytesBase2(1536, false)).toBe('1.5 KiB');
  });

  it('formats negative values with a leading minus sign', () => {
    expect(formatBytesBase2(-1)).toBe('-1.0 B');
    expect(formatBytesBase2(-1023)).toBe('-1023.0 B');
  });
});
