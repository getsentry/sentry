import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

describe('intervalToMilliseconds()', () => {
  it('can convert standard formats', () => {
    expect(intervalToMilliseconds('24h')).toBe(86400000);
    expect(intervalToMilliseconds('30m')).toBe(1800000);
    expect(intervalToMilliseconds('15m')).toBe(900000);
    expect(intervalToMilliseconds('5m')).toBe(300000);
    expect(intervalToMilliseconds('1m')).toBe(60000);
  });

  it('can convert arbitrary formats', () => {
    expect(intervalToMilliseconds('8w')).toBe(4838400000);
    expect(intervalToMilliseconds('30d')).toBe(2592000000);
    expect(intervalToMilliseconds('7d')).toBe(604800000);
    expect(intervalToMilliseconds('1d')).toBe(86400000);
    expect(intervalToMilliseconds('1h')).toBe(3600000);
    expect(intervalToMilliseconds('2m')).toBe(120000);
  });
});
