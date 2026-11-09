import {getAnomalyDetectionDisabledReason} from './getAnomalyDetectionDisabledReason';

const valid = {
  datetime: {period: '7d', start: null, end: null, utc: null},
  groupBys: [''],
  interval: '1h',
  projects: [1],
  yAxisCount: 1,
};

describe('getAnomalyDetectionDisabledReason', () => {
  it('allows a single project, single function, supported interval and range', () => {
    expect(getAnomalyDetectionDisabledReason(valid)).toBeNull();
  });

  it.each([[[]], [[-1]], [[1, 2]]])('requires a single project (%j)', projects => {
    expect(getAnomalyDetectionDisabledReason({...valid, projects})).toBe(
      'Select a single project'
    );
  });

  it('disables with a group by', () => {
    expect(getAnomalyDetectionDisabledReason({...valid, groupBys: ['span.op']})).toBe(
      'Remove the group by'
    );
  });

  it('disables with more than one function', () => {
    expect(getAnomalyDetectionDisabledReason({...valid, yAxisCount: 2})).toBe(
      'Plot a single function'
    );
  });

  it.each(['5m', '10m', '15m', '30m', '1h', '2h', '4h', '1d', '60m'])(
    'allows the %s interval',
    interval => {
      expect(getAnomalyDetectionDisabledReason({...valid, interval})).toBeNull();
    }
  );

  it.each(['1m', '3h', '6h', '12h'])('disables the %s interval', interval => {
    expect(getAnomalyDetectionDisabledReason({...valid, interval})).toBe(
      'Use a 5m, 10m, 15m, 30m, 1h, 2h, 4h or 1d interval'
    );
  });

  it('disables ranges over 7 days', () => {
    expect(
      getAnomalyDetectionDisabledReason({
        ...valid,
        datetime: {period: '14d', start: null, end: null, utc: null},
      })
    ).toBe('Select a time range of 7 days or less');
    expect(
      getAnomalyDetectionDisabledReason({
        ...valid,
        datetime: {
          period: null,
          start: '2026-11-01T00:00:00',
          end: '2026-11-08T00:01:00',
          utc: null,
        },
      })
    ).toBe('Select a time range of 7 days or less');
  });
});
