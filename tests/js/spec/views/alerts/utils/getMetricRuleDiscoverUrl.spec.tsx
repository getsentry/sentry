import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {getMetricRuleDiscoverQuery} from 'sentry/views/alerts/utils/getMetricRuleDiscoverUrl';

describe('getMetricRuleDiscoverQuery', () => {
  it('should use metric aggregate in discover query', () => {
    const rule = TestStubs.MetricRule({
      aggregate: 'failure_rate()',
      dataset: Dataset.TRANSACTIONS,
    });
    const projects = [TestStubs.Project()];
    const query = getMetricRuleDiscoverQuery({
      rule,
      projects,
      timePeriod: {
        period: '7d',
        usingPeriod: true,
        start: new Date().toISOString(),
        end: new Date().toISOString(),
      },
    });
    expect(query.valueOf()).toEqual(
      expect.objectContaining({
        statsPeriod: '7d',
        fields: [
          {
            field: 'transaction',
            width: -1,
          },
          {
            field: 'project',
            width: -1,
          },
          {
            field: 'failure_rate()',
            width: -1,
          },
          {
            field: 'count_unique(user)',
            width: -1,
          },
          {
            field: 'user_misery(300)',
            width: -1,
          },
        ],
      })
    );
  });
});
