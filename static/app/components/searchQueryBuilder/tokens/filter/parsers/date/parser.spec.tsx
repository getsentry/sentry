import {parseFilterValueDate} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/date/parser';
import {Token} from 'sentry/components/searchSyntax/parser';

describe('parseFilterValueDate', () => {
  it('parses relative dates', () => {
    expect(parseFilterValueDate('-7d')).toMatchObject({
      sign: '-',
      type: Token.VALUE_RELATIVE_DATE,
      unit: 'd',
      value: '7',
    });
  });

  it('parses absolute dates', () => {
    expect(parseFilterValueDate('2017-10-17T02:41:00Z')).toMatchObject({
      date: '2017-10-17',
      time: '02:41:00',
      type: Token.VALUE_ISO_8601_DATE,
      tz: 'Z',
      value: '2017-10-17T02:41:00Z',
    });
  });

  it('rejects non-date values', () => {
    expect(parseFilterValueDate('100ms')).toBeNull();
  });
});
