import {parsePercent} from 'sentry/views/settings/dynamicSampling/utils/parsePercent';

describe('parsePercent', () => {
  it('parses a valid percent', () => {
    expect(parsePercent('50')).toEqual(0.5);
    expect(parsePercent('100')).toEqual(1);
    expect(parsePercent('0')).toEqual(0);

    expect(parsePercent('50.5')).toEqual(0.505);
    expect(parsePercent('1.5%')).toEqual(0.015);
  });

  it('falls back to default value', () => {
    expect(parsePercent(undefined, 0.1)).toEqual(0.1);
    expect(parsePercent(null, 0.2)).toEqual(0.2);
    expect(parsePercent('', 0.3)).toEqual(0.3);
    expect(parsePercent('invalid', 0.4)).toEqual(0.4);
  });

  it('clamps to 0-1 range', () => {
    expect(parsePercent('-1')).toEqual(0);
    expect(parsePercent('101')).toEqual(1);
  });

  it('return 0 as default fallback', () => {
    expect(parsePercent(null)).toEqual(0);
  });
});
