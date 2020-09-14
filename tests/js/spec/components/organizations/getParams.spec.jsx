import {
  getParams,
  parseStatsPeriod,
} from 'app/components/organizations/globalSelectionHeader/getParams';

describe('getParams', function() {
  it('should return default statsPeriod if it is not provided or is invalid', function() {
    expect(getParams({})).toEqual({statsPeriod: '14d'});
    expect(getParams({statsPeriod: 'invalid'})).toEqual({statsPeriod: '14d'});
    expect(getParams({statsPeriod: null})).toEqual({statsPeriod: '14d'});
    expect(getParams({statsPeriod: undefined})).toEqual({statsPeriod: '14d'});
    expect(getParams({statsPeriod: '24f'})).toEqual({statsPeriod: '14d'});
    expect(getParams({statsPeriod: '24'})).toEqual({statsPeriod: '24s'});
  });

  it('should parse statsPeriod', function() {
    expect(getParams({statsPeriod: '5s'})).toEqual({statsPeriod: '5s'});
    expect(getParams({statsPeriod: '11h'})).toEqual({statsPeriod: '11h'});
    expect(getParams({statsPeriod: '14d'})).toEqual({statsPeriod: '14d'});
    expect(getParams({statsPeriod: '24w'})).toEqual({statsPeriod: '24w'});
    expect(getParams({statsPeriod: '42m'})).toEqual({statsPeriod: '42m'});
  });

  it('should parse first valid statsPeriod', function() {
    expect(getParams({statsPeriod: ['invalid', '24d', '5s']})).toEqual({
      statsPeriod: '24d',
    });
  });

  it('should return statsPeriod if statsPeriod, start, and end are provided', function() {
    expect(
      getParams({
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        statsPeriod: '55d',
        period: '90d',
      })
    ).toEqual({statsPeriod: '55d'});

    expect(
      getParams({
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        statsPeriod: '55d',
      })
    ).toEqual({statsPeriod: '55d'});

    expect(
      getParams({
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        period: '55d',
      })
    ).toEqual({statsPeriod: '55d'});
  });

  it('should parse start and end', function() {
    expect(
      getParams({start: '2019-10-01T00:00:00', end: '2019-10-02T00:00:00'})
    ).toEqual({start: '2019-10-01T00:00:00.000', end: '2019-10-02T00:00:00.000'});

    expect(
      getParams({start: '2019-10-23T04:28:49+0000', end: '2019-10-26T02:56:17+0000'})
    ).toEqual({start: '2019-10-23T04:28:49.000', end: '2019-10-26T02:56:17.000'});
  });

  it('should parse first valid start and end', function() {
    expect(
      getParams({
        start: ['invalid', '2019-10-01T00:00:00', '2020-10-01T00:00:00'],
        end: ['invalid', '2019-10-02T00:00:00', '2020-10-02T00:00:00'],
      })
    ).toEqual({start: '2019-10-01T00:00:00.000', end: '2019-10-02T00:00:00.000'});
  });

  it('should return default statsPeriod if both start and end are not provided, or either are invalid', function() {
    expect(getParams({start: '2019-10-01T00:00:00'})).toEqual({
      statsPeriod: '14d',
    });
    expect(getParams({start: null})).toEqual({
      statsPeriod: '14d',
    });
    expect(getParams({start: undefined})).toEqual({
      statsPeriod: '14d',
    });

    expect(getParams({end: '2019-10-01T00:00:00'})).toEqual({
      statsPeriod: '14d',
    });
    expect(getParams({end: null})).toEqual({
      statsPeriod: '14d',
    });
    expect(getParams({end: undefined})).toEqual({
      statsPeriod: '14d',
    });

    expect(getParams({start: undefined, end: undefined})).toEqual({
      statsPeriod: '14d',
    });
    expect(getParams({start: null, end: undefined})).toEqual({
      statsPeriod: '14d',
    });
    expect(getParams({start: undefined, end: null})).toEqual({
      statsPeriod: '14d',
    });
    expect(getParams({start: null, end: null})).toEqual({
      statsPeriod: '14d',
    });

    expect(
      getParams({
        start: ['invalid'],
        end: ['invalid'],
      })
    ).toEqual({statsPeriod: '14d'});

    expect(
      getParams({
        start: ['invalid'],
        end: ['invalid', '2019-10-02T00:00:00', '2020-10-02T00:00:00'],
      })
    ).toEqual({statsPeriod: '14d'});

    expect(
      getParams({
        start: ['invalid', '2019-10-01T00:00:00', '2020-10-01T00:00:00'],
        end: ['invalid'],
      })
    ).toEqual({statsPeriod: '14d'});
  });

  it('does not return default statsPeriod if `allowEmptyPeriod` option is passed', function() {
    expect(getParams({}, {allowEmptyPeriod: true})).toEqual({});
  });

  it('should parse utc when it is defined', function() {
    expect(getParams({utc: 'true'})).toEqual({utc: 'true', statsPeriod: '14d'});
    expect(getParams({utc: 'false'})).toEqual({utc: 'false', statsPeriod: '14d'});
    expect(getParams({utc: 'invalid'})).toEqual({utc: 'false', statsPeriod: '14d'});

    expect(getParams({utc: null})).toEqual({statsPeriod: '14d'});
    expect(getParams({utc: undefined})).toEqual({statsPeriod: '14d'});
  });
});

describe('parseStatsPeriod', function() {
  it('should parse statsPeriod', function() {
    expect(parseStatsPeriod('5s')).toEqual({period: '5', periodLength: 's'});
    expect(parseStatsPeriod('11h')).toEqual({period: '11', periodLength: 'h'});
    expect(parseStatsPeriod('14d')).toEqual({period: '14', periodLength: 'd'});
    expect(parseStatsPeriod('24w')).toEqual({period: '24', periodLength: 'w'});
    expect(parseStatsPeriod('42m')).toEqual({period: '42', periodLength: 'm'});
  });

  it('should return default statsPeriod if it is not provided or is invalid', function() {
    expect(parseStatsPeriod('invalid')).toEqual(undefined);
    expect(parseStatsPeriod('24f')).toEqual(undefined);
    expect(parseStatsPeriod('')).toEqual(undefined);
    expect(parseStatsPeriod('24')).toEqual({period: '24', periodLength: 's'});
  });

  it('does not return start and end if `allowAbsoluteDatetime` option is passed', function() {
    expect(
      getParams(
        {start: '2019-10-01T00:00:00', end: '2019-10-02T00:00:00'},
        {allowAbsoluteDatetime: false}
      )
    ).toEqual({statsPeriod: '14d'});
  });
});
