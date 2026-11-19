import {getIntlFormatter} from './intlFormatter';

describe('getIntlFormatter', () => {
  it('reuses a formatter for the same locale and options', () => {
    const options = {timeZone: 'UTC', month: 'short'} as const;

    expect(getIntlFormatter(Intl.DateTimeFormat, 'en-US', options)).toBe(
      getIntlFormatter(Intl.DateTimeFormat, 'en-US', {...options})
    );
  });

  it('creates separate formatters for other locales, options, and kinds', () => {
    const formatter = getIntlFormatter(Intl.DateTimeFormat, 'en-US', {timeZone: 'UTC'});

    expect(getIntlFormatter(Intl.DateTimeFormat, 'de', {timeZone: 'UTC'})).not.toBe(
      formatter
    );
    expect(
      getIntlFormatter(Intl.DateTimeFormat, 'en-US', {timeZone: 'Asia/Tokyo'})
    ).not.toBe(formatter);
    expect(getIntlFormatter(Intl.NumberFormat, 'en-US', {})).toBeInstanceOf(
      Intl.NumberFormat
    );
  });
});
