import * as Sentry from '@sentry/react';

import type {MetricMeta} from 'sentry/types/metrics';
import {
  getDefaultAggregation,
  isAllowedAggregation,
  isVirtualMetric,
} from 'sentry/utils/metrics';
import {emptyMetricsQueryWidget} from 'sentry/utils/metrics/constants';

/**
 * Creates a new widget, can be passed a metrics meta object to base the new widget on it
 * @param metricsMeta metrics meta on which the widget should be based
 * @param defaultCondition selected condition. only needed for virtual metrics
 * @returns
 */
export function getNewMetricsWidget(metricsMeta?: MetricMeta, defaultCondition?: number) {
  const mri = metricsMeta?.mri || emptyMetricsQueryWidget.mri;
  let condition = emptyMetricsQueryWidget.condition;
  let aggregation = getDefaultAggregation(mri);

  if (metricsMeta && isVirtualMetric(metricsMeta)) {
    if (!defaultCondition) {
      Sentry.captureMessage(
        'Metrics: Trying to create widget from virtual MRI without condition'
      );
      // Invalid data -> falling back to default
      return emptyMetricsQueryWidget;
    }

    condition = defaultCondition;

    const allowedAggregation = metricsMeta.operations.find(isAllowedAggregation);
    if (!allowedAggregation) {
      Sentry.captureMessage(
        'Metrics: No allowed aggregations available for virtual metric found'
      );
      // Invalid data -> falling back to default
      return emptyMetricsQueryWidget;
    }
    aggregation = allowedAggregation;
  }

  return {
    ...emptyMetricsQueryWidget,
    mri,
    condition,
    aggregation,
  };
}
