import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {matchTimeSeriesToTableRow} from './matchTimeSeriestoTableRow';

describe('matchTimeSeriesToTableRow', () => {
  it('returns the first row value when there is no groupBy', () => {
    const result = matchTimeSeriesToTableRow({
      tableDataRows: [{id: '1', 'count()': 42}],
      timeSeries: TimeSeriesFixture({yAxis: 'count()', groupBy: undefined}),
    });

    expect(result).toBe(42);
  });

  it('returns null when there are no rows and no groupBy', () => {
    const result = matchTimeSeriesToTableRow({
      tableDataRows: [],
      timeSeries: TimeSeriesFixture({yAxis: 'count()', groupBy: undefined}),
    });

    expect(result).toBeNull();
  });

  it('matches a row by a single groupBy value', () => {
    const result = matchTimeSeriesToTableRow({
      tableDataRows: [
        {id: '1', 'browser.name': 'Chrome', 'count()': 10},
        {id: '2', 'browser.name': 'Firefox', 'count()': 5},
      ],
      timeSeries: TimeSeriesFixture({
        yAxis: 'count()',
        groupBy: [{key: 'browser.name', value: 'Firefox'}],
      }),
    });

    expect(result).toBe(5);
  });

  it('matches a row by multiple groupBy values', () => {
    const result = matchTimeSeriesToTableRow({
      tableDataRows: [
        {id: '1', 'browser.name': 'Chrome', 'os.name': 'Windows', 'count()': 10},
        {id: '2', 'browser.name': 'Chrome', 'os.name': 'Mac', 'count()': 7},
        {id: '3', 'browser.name': 'Firefox', 'os.name': 'Windows', 'count()': 5},
      ],
      timeSeries: TimeSeriesFixture({
        yAxis: 'count()',
        groupBy: [
          {key: 'browser.name', value: 'Chrome'},
          {key: 'os.name', value: 'Mac'},
        ],
      }),
    });

    expect(result).toBe(7);
  });

  it('returns null when no row matches the groupBy', () => {
    const result = matchTimeSeriesToTableRow({
      tableDataRows: [{id: '1', 'browser.name': 'Chrome', 'count()': 10}],
      timeSeries: TimeSeriesFixture({
        yAxis: 'count()',
        groupBy: [{key: 'browser.name', value: 'Safari'}],
      }),
    });

    expect(result).toBeNull();
  });

  it('matches numeric table values to string groupBy values', () => {
    const result = matchTimeSeriesToTableRow({
      tableDataRows: [
        {id: '1', 'http.response_status_code': 200, 'count()': 50},
        {id: '2', 'http.response_status_code': 404, 'count()': 3},
      ],
      timeSeries: TimeSeriesFixture({
        yAxis: 'count()',
        groupBy: [{key: 'http.response_status_code', value: '200'}],
      }),
    });

    expect(result).toBe(50);
  });

  it('returns the first row value when groupBy is an empty array', () => {
    const result = matchTimeSeriesToTableRow({
      tableDataRows: [{id: '1', 'count()': 42}],
      timeSeries: TimeSeriesFixture({yAxis: 'count()', groupBy: []}),
    });

    expect(result).toBe(42);
  });

  it('matches null groupBy values correctly', () => {
    const result = matchTimeSeriesToTableRow({
      tableDataRows: [
        {id: '1', project: 'None', 'count()': 15},
        {id: '2', project: 'my-project', 'count()': 25},
      ],
      timeSeries: TimeSeriesFixture({
        yAxis: 'count()',
        groupBy: [{key: 'project', value: null}],
      }),
    });

    expect(result).toBe(15);
  });

  it('matches array groupBy values with strings correctly', () => {
    const result = matchTimeSeriesToTableRow({
      tableDataRows: [
        {id: '1', 'error.type': "['ValueError', 'TypeError']", 'count()': 10},
        {id: '2', 'error.type': "['Exception']", 'count()': 5},
      ],
      timeSeries: TimeSeriesFixture({
        yAxis: 'count()',
        groupBy: [{key: 'error.type', value: ['ValueError', 'TypeError']}],
      }),
    });

    expect(result).toBe(10);
  });

  it('matches array groupBy values with null elements correctly', () => {
    const result = matchTimeSeriesToTableRow({
      tableDataRows: [
        {id: '1', 'error.type': "['Exception', None, 'TypeError']", 'count()': 20},
        {id: '2', 'error.type': "['ValueError']", 'count()': 8},
      ],
      timeSeries: TimeSeriesFixture({
        yAxis: 'count()',
        groupBy: [{key: 'error.type', value: ['Exception', null, 'TypeError']}],
      }),
    });

    expect(result).toBe(20);
  });

  it('matches array groupBy values with numbers correctly', () => {
    const result = matchTimeSeriesToTableRow({
      tableDataRows: [
        {id: '1', 'status_codes': '[200, 404]', 'count()': 30},
        {id: '2', 'status_codes': '[500]', 'count()': 2},
      ],
      timeSeries: TimeSeriesFixture({
        yAxis: 'count()',
        groupBy: [{key: 'status_codes', value: [200, 404]}],
      }),
    });

    expect(result).toBe(30);
  });
});
