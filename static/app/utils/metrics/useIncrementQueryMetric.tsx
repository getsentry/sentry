import {useCallback} from 'react';
import * as Sentry from '@sentry/react';

import type {MRI} from 'sentry/types';
import {getDefaultMetricDisplayType} from 'sentry/utils/metrics';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import {parseMRI} from 'sentry/utils/metrics/mri';
import type {MetricDisplayType} from 'sentry/utils/metrics/types';

interface Options {
  displayType: MetricDisplayType;
  mri: MRI;
  groupBy?: string[];
  op?: string;
  query?: string;
}

export const useIncrementQueryMetric = (options: Options) => {
  return useCallback(
    (metricName: string, values: Partial<Options>) => {
      const mergedValues = {
        displayType: options.displayType,
        mri: options.mri,
        groupBy: options.groupBy,
        op: options.op,
        query: options.query,
        ...values,
      };
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
    },
    [options.displayType, options.mri, options.groupBy, options.op, options.query]
  );
};
