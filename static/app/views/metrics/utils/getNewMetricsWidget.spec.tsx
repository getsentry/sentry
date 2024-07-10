import * as Sentry from '@sentry/react';

import type {MetricAggregation, MetricMeta, MetricType} from 'sentry/types/metrics';
import {emptyMetricsQueryWidget} from 'sentry/utils/metrics/constants';
import {getNewMetricsWidget} from 'sentry/views/metrics/utils/getNewMetricsWidget';

describe('getNewMetricsWidget', () => {
  it('creates a default widget', () => {
    expect(getNewMetricsWidget()).toEqual(emptyMetricsQueryWidget);
  });

  it('creates a widget for a count metric', () => {
    const meta = createMeta('c');
    expect(getNewMetricsWidget(meta)).toEqual({
      ...emptyMetricsQueryWidget,
      mri: meta.mri,
      aggregation: 'sum',
    });
  });

  it('creates a widget for a set metric', () => {
    const meta = createMeta('s');
    expect(getNewMetricsWidget(meta)).toEqual({
      ...emptyMetricsQueryWidget,
      mri: meta.mri,
      aggregation: 'count_unique',
    });
  });

  it('creates a widget for a gauge metric', () => {
    const meta = createMeta('g');
    expect(getNewMetricsWidget(meta)).toEqual({
      ...emptyMetricsQueryWidget,
      mri: meta.mri,
      aggregation: 'avg',
    });
  });

  it('creates a widget for a distribution metric', () => {
    const meta = createMeta('d');
    expect(getNewMetricsWidget(meta)).toEqual({
      ...emptyMetricsQueryWidget,
      mri: meta.mri,
      aggregation: 'avg',
    });
  });

  it('creates a widget for a virtual metric', () => {
    const meta = createMeta('v', ['p99', 'min'] as const);
    expect(getNewMetricsWidget(meta, 23)).toEqual({
      ...emptyMetricsQueryWidget,
      mri: meta.mri,
      // Uses the first available aggregation
      aggregation: 'p99',
      condition: 23,
    });
  });

  it('logs message and falls back to default if there is no condition for virtual metrics', () => {
    const sentrySpy = jest.spyOn(Sentry, 'captureMessage');
    const meta = createMeta('v', ['p99', 'min'] as const);
    expect(getNewMetricsWidget(meta)).toEqual(emptyMetricsQueryWidget);

    expect(sentrySpy).toHaveBeenCalledTimes(1);
    expect(sentrySpy).toHaveBeenCalledWith(
      'Metrics: Trying to create widget from virtual MRI without condition'
    );
  });

  it('logs message and falls back to default if there is no allowed aggregation', () => {
    const sentrySpy = jest.spyOn(Sentry, 'captureMessage');
    const meta = createMeta('v', ['max_timestamp' as MetricAggregation] as const);
    expect(getNewMetricsWidget(meta, 42)).toEqual(emptyMetricsQueryWidget);

    expect(sentrySpy).toHaveBeenCalledTimes(1);
    expect(sentrySpy).toHaveBeenCalledWith(
      'Metrics: No allowed aggregations available for virtual metric found'
    );
  });
});

function createMeta(type: MetricType, operations: MetricAggregation[] = []): MetricMeta {
  return {
    mri: `${type}:custom/my-metrics@none`,
    operations,
    blockingStatus: [],
    projectIds: [],
    type,
    unit: 'none',
  };
}
