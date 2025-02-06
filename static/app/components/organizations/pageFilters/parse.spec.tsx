import {
  normalizeDateTimeParams,
  parseStatsPeriod,
} from 'sentry/components/organizations/pageFilters/parse';

describe('normalizeDateTimeParams', function () {
  it('should return default statsPeriod if it is not provided or is invalid', function () {
    expect(normalizeDateTimeParams({})).toEqual({statsPeriod: '14d'});
    expect(normalizeDateTimeParams({statsPeriod: 'invalid'})).toEqual({
      statsPeriod: '14d',
    });
    expect(normalizeDateTimeParams({statsPeriod: null})).toEqual({statsPeriod: '14d'});
    expect(normalizeDateTimeParams({statsPeriod: undefined})).toEqual({
      statsPeriod: '14d',
    });
    expect(normalizeDateTimeParams({statsPeriod: '24f'})).toEqual({statsPeriod: '14d'});
    expect(normalizeDateTimeParams({statsPeriod: '24'})).toEqual({statsPeriod: '24s'});
  });

  it('should parse statsPeriod', function () {
    expect(normalizeDateTimeParams({statsPeriod: '5s'})).toEqual({statsPeriod: '5s'});
    expect(normalizeDateTimeParams({statsPeriod: '11h'})).toEqual({statsPeriod: '11h'});
    expect(normalizeDateTimeParams({statsPeriod: '14d'})).toEqual({statsPeriod: '14d'});
    expect(normalizeDateTimeParams({statsPeriod: '24w'})).toEqual({statsPeriod: '24w'});
    expect(normalizeDateTimeParams({statsPeriod: '42m'})).toEqual({statsPeriod: '42m'});
  });

  it('should parse first valid statsPeriod', function () {
    expect(normalizeDateTimeParams({statsPeriod: ['invalid', '24d', '5s']})).toEqual({
      statsPeriod: '24d',
    });
  });

  it('should return statsPeriod if statsPeriod, start, and end are provided', function () {
    expect(
      normalizeDateTimeParams({
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        statsPeriod: '55d',
        period: '90d',
      })
    ).toEqual({statsPeriod: '55d'});

    expect(
      normalizeDateTimeParams({
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        statsPeriod: '55d',
      })
    ).toEqual({statsPeriod: '55d'});

    expect(
      normalizeDateTimeParams({
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        period: '55d',
      })
    ).toEqual({statsPeriod: '55d'});
  });

  it('should parse start and end', function () {
    expect(
      normalizeDateTimeParams({start: '2019-10-01T00:00:00', end: '2019-10-02T00:00:00'})
    ).toEqual({start: '2019-10-01T00:00:00.000', end: '2019-10-02T00:00:00.000'});

    expect(
      normalizeDateTimeParams({
        start: '2019-10-23T04:28:49+0000',
        end: '2019-10-26T02:56:17+0000',
      })
    ).toEqual({start: '2019-10-23T04:28:49.000', end: '2019-10-26T02:56:17.000'});
  });

  it('should parse first valid start and end', function () {
    expect(
      normalizeDateTimeParams({
        start: ['invalid', '2019-10-01T00:00:00', '2020-10-01T00:00:00'],
        end: ['invalid', '2019-10-02T00:00:00', '2020-10-02T00:00:00'],
      })
    ).toEqual({start: '2019-10-01T00:00:00.000', end: '2019-10-02T00:00:00.000'});
  });

  it('should return default statsPeriod if both start and end are not provided, or either are invalid', function () {
    expect(normalizeDateTimeParams({start: '2019-10-01T00:00:00'})).toEqual({
      statsPeriod: '14d',
    });
    expect(normalizeDateTimeParams({start: null})).toEqual({
      statsPeriod: '14d',
    });
    expect(normalizeDateTimeParams({start: undefined})).toEqual({
      statsPeriod: '14d',
    });

    expect(normalizeDateTimeParams({end: '2019-10-01T00:00:00'})).toEqual({
      statsPeriod: '14d',
    });
    expect(normalizeDateTimeParams({end: null})).toEqual({
      statsPeriod: '14d',
    });
    expect(normalizeDateTimeParams({end: undefined})).toEqual({
      statsPeriod: '14d',
    });

    expect(normalizeDateTimeParams({start: undefined, end: undefined})).toEqual({
      statsPeriod: '14d',
    });
    expect(normalizeDateTimeParams({start: null, end: undefined})).toEqual({
      statsPeriod: '14d',
    });
    expect(normalizeDateTimeParams({start: undefined, end: null})).toEqual({
      statsPeriod: '14d',
    });
    expect(normalizeDateTimeParams({start: null, end: null})).toEqual({
      statsPeriod: '14d',
    });

    expect(
      normalizeDateTimeParams({
        start: ['invalid'],
        end: ['invalid'],
      })
    ).toEqual({statsPeriod: '14d'});

    expect(
      normalizeDateTimeParams({
        start: ['invalid'],
        end: ['invalid', '2019-10-02T00:00:00', '2020-10-02T00:00:00'],
      })
    ).toEqual({statsPeriod: '14d'});

    expect(
      normalizeDateTimeParams({
        start: ['invalid', '2019-10-01T00:00:00', '2020-10-01T00:00:00'],
        end: ['invalid'],
      })
    ).toEqual({statsPeriod: '14d'});
  });

  it('should use pageStart/pageEnd/pageUtc to override start/end/utc', function () {
    expect(
      normalizeDateTimeParams(
        {
          pageStart: '2021-10-23T04:28:49+0000',
          pageEnd: '2021-10-26T02:56:17+0000',
          pageUtc: 'true',
          start: '2019-10-23T04:28:49+0000',
          end: '2019-10-26T02:56:17+0000',
          utc: 'false',
        },
        {allowAbsolutePageDatetime: true}
      )
    ).toEqual({
      start: '2021-10-23T04:28:49.000',
      end: '2021-10-26T02:56:17.000',
      utc: 'true',
    });
  });

  it('should use pageStatsPeriod to override statsPeriod', function () {
    expect(
      normalizeDateTimeParams({
        pageStart: '2021-10-23T04:28:49+0000',
        pageEnd: '2021-10-26T02:56:17+0000',
        pageUtc: 'true',
        pageStatsPeriod: '90d',
        start: '2019-10-23T04:28:49+0000',
        end: '2019-10-26T02:56:17+0000',
        utc: 'false',
        statsPeriod: '14d',
      })
    ).toEqual({
      statsPeriod: '90d',
    });
  });

  it('does not return default statsPeriod if `allowEmptyPeriod` option is passed', function () {
    expect(normalizeDateTimeParams({}, {allowEmptyPeriod: true})).toEqual({});
  });

  it('should parse utc when it is defined', function () {
    expect(
      normalizeDateTimeParams({
        utc: 'true',
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
      })
    ).toEqual({
      utc: 'true',
      start: '2019-10-01T00:00:00.000',
      end: '2019-10-02T00:00:00.000',
    });
    expect(
      normalizeDateTimeParams({
        utc: 'false',
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
      })
    ).toEqual({
      utc: 'false',
      start: '2019-10-01T00:00:00.000',
      end: '2019-10-02T00:00:00.000',
    });
    expect(
      normalizeDateTimeParams({
        utc: 'invalid',
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
      })
    ).toEqual({
      utc: 'false',
      start: '2019-10-01T00:00:00.000',
      end: '2019-10-02T00:00:00.000',
    });

    expect(normalizeDateTimeParams({utc: null})).toEqual({statsPeriod: '14d'});
    expect(normalizeDateTimeParams({utc: undefined})).toEqual({statsPeriod: '14d'});
  });
});

describe('parseStatsPeriod', function () {
  it('should parse statsPeriod', function () {
    expect(parseStatsPeriod('5s')).toEqual({period: '5', periodLength: 's'});
    expect(parseStatsPeriod('11h')).toEqual({period: '11', periodLength: 'h'});
    expect(parseStatsPeriod('14d')).toEqual({period: '14', periodLength: 'd'});
    expect(parseStatsPeriod('24w')).toEqual({period: '24', periodLength: 'w'});
    expect(parseStatsPeriod('42m')).toEqual({period: '42', periodLength: 'm'});
  });

  it('should return default statsPeriod if it is not provided or is invalid', function () {
    expect(parseStatsPeriod('invalid')).toBeUndefined();
    expect(parseStatsPeriod('24f')).toBeUndefined();
    expect(parseStatsPeriod('')).toBeUndefined();
    expect(parseStatsPeriod('24')).toEqual({period: '24', periodLength: 's'});
  });

  it('does not return start and end if `allowAbsoluteDatetime` option is passed', function () {
    expect(
      normalizeDateTimeParams(
        {start: '2019-10-01T00:00:00', end: '2019-10-02T00:00:00'},
        {allowAbsoluteDatetime: false}
      )
    ).toEqual({statsPeriod: '14d'});
  });
});
