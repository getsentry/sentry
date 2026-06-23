import {
  MetricDetectorFixture,
  SnubaQueryDataSourceFixture,
} from 'sentry-fixture/detectors';
import {ProjectFixture} from 'sentry-fixture/project';

import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {getMetricRuleFromDetector} from 'sentry/views/issueDetails/metricIssues/utils';

describe('getMetricRuleFromDetector', () => {
  const project = ProjectFixture();

  it('maps a metric detector snuba query into a MetricRule', () => {
    const detector = MetricDetectorFixture({
      config: {detectionType: 'static'},
      dataSources: [
        SnubaQueryDataSourceFixture({
          queryObj: {
            id: '1',
            status: 1,
            subscription: '1',
            snubaQuery: {
              id: '',
              aggregate: 'count_unique(user)',
              dataset: Dataset.ERRORS,
              query: 'is:unresolved',
              // seconds; should be converted to minutes
              timeWindow: 3600,
              eventTypes: [EventTypes.ERROR],
              environment: 'prod',
            },
          },
        }),
      ],
    });

    const rule = getMetricRuleFromDetector(detector, project);

    expect(rule.aggregate).toBe('count_unique(user)');
    expect(rule.dataset).toBe(Dataset.ERRORS);
    expect(rule.query).toBe('is:unresolved');
    expect(rule.eventTypes).toEqual([EventTypes.ERROR]);
    expect(rule.environment).toBe('prod');
    expect(rule.projects).toEqual([project.slug]);
    expect(rule.detectionType).toBe('static');
    // 3600s -> 60m
    expect(rule.timeWindow).toBe(60);
  });

  it('defaults environment to null when the snuba query has none', () => {
    const detector = MetricDetectorFixture();

    const rule = getMetricRuleFromDetector(detector, project);

    expect(rule.environment).toBeNull();
  });
});
