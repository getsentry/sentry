import * as Sentry from '@sentry/react';

import {MRI} from 'sentry/types';
import {
  getDefaultMetricDisplayType,
  getReadableMetricType,
  MetricDisplayType,
} from 'sentry/utils/metrics';
import {parseMRI} from 'sentry/utils/metrics/mri';

interface Options {
  displayType: MetricDisplayType;
  mri: MRI;
  groupBy?: string[];
  op?: string;
  query?: string;
}

export const useIncrementQueryMetric = (options: Options) => {
  return (metricName: string, values: Partial<Options>) => {
    const mergedValues = {...options, ...values};
    Sentry.metrics.increment(metricName, 1, {
      tags: {
        display:
          mergedValues.displayType ??
          getDefaultMetricDisplayType(mergedValues.mri, mergedValues.op),
        type: getReadableMetricType(parseMRI(mergedValues.mri)?.type),
        operation: mergedValues.op,
        isGrouped: !!mergedValues.groupBy?.length,
        isFiltered: !!mergedValues.query,
      },
    });
  };
};
