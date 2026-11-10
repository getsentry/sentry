import {getAnomalyDetectionDisabledReason} from './getAnomalyDetectionDisabledReason';

const valid = {
  datetime: {period: '7d', start: null, end: null, utc: null},
  groupBys: [''],
  projects: [1],
  yAxisCount: 1,
};

describe('getAnomalyDetectionDisabledReason', () => {
  it('allows a single project and function over any range of 5 minutes or more', () => {
    expect(getAnomalyDetectionDisabledReason(valid)).toBeNull();
    for (const period of ['5m', '1h', '24h', '14d', '30d', '90d']) {
      expect(
        getAnomalyDetectionDisabledReason({
          ...valid,
          datetime: {period, start: null, end: null, utc: null},
        })
      ).toBeNull();
    }
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

  it('disables ranges shorter than 5 minutes', () => {
    expect(
      getAnomalyDetectionDisabledReason({
        ...valid,
        datetime: {period: '3m', start: null, end: null, utc: null},
      })
    ).toBe('Select a time range of at least 5 minutes');
  });
});
