import type {MetricMeta} from 'sentry/types/metrics';

import {getMetricsWithDuplicateNames} from '.';

function createMetricMeta(name: string, unit: string): MetricMeta {
  return {
    mri: `d:custom/${name}@${unit}`,
    blockingStatus: [],
    operations: [],
    projectIds: [],
    type: 'd',
    unit: unit,
  };
}

describe('getMetricsWithDuplicateNames', () => {
  it('should return a duplicate metric', () => {
    const metrics: MetricMeta[] = [
      createMetricMeta('metric1', 'none'),
      createMetricMeta('metric1', 'seconds'),
      createMetricMeta('metric2', 'milliseconds'),
    ];
    const result = getMetricsWithDuplicateNames(metrics);
    expect(result).toEqual(
      new Set(['d:custom/metric1@none', 'd:custom/metric1@seconds'])
    );
  });

  it('should multiple duplicate metrics', () => {
    const metrics: MetricMeta[] = [
      createMetricMeta('metric1', 'none'),
      createMetricMeta('metric1', 'seconds'),

      createMetricMeta('metric2', 'none'),
      createMetricMeta('metric2', 'milliseconds'),

      createMetricMeta('metric3', 'none'),
    ];
    const result = getMetricsWithDuplicateNames(metrics);
    expect(result).toEqual(
      new Set([
        'd:custom/metric1@none',
        'd:custom/metric1@seconds',
        'd:custom/metric2@none',
        'd:custom/metric2@milliseconds',
      ])
    );
  });

  it('should return an empty set if there are no duplicates', () => {
    const metrics: MetricMeta[] = [
      createMetricMeta('metric1', 'none'),
      createMetricMeta('metric2', 'seconds'),
      createMetricMeta('metric3', 'milliseconds'),
    ];
    const result = getMetricsWithDuplicateNames(metrics);
    expect(result).toEqual(new Set());
  });
});
