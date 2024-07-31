import * as Sentry from '@sentry/react';

import type {DateTimeObject, GranularityLadder} from 'sentry/components/charts/utils';
import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {
  COUNTER_GRANULARITIES,
  DISTRIBUTION_GRANULARITIES,
} from 'sentry/views/insights/database/settings';
import type {Aggregate, SpanFunctions} from 'sentry/views/insights/types';
import {
  COUNTER_AGGREGATES,
  DISTRIBUTION_AGGREGATES,
  SPAN_FUNCTIONS,
} from 'sentry/views/insights/types';

export function getIntervalForMetricFunction(
  metricFunction: Aggregate | SpanFunctions | string,
  datetimeObj: DateTimeObject
) {
  const {start, end, period, utc} = datetimeObj;

  const interval = Sentry.startSpan(
    {
      op: 'function',
      name: 'getIntervalForMetricFunction',
      attributes: {
        start: start ? start.toString() : undefined,
        end: end ? end.toString() : undefined,
        period: period || undefined,
        utc: utc || undefined,
      },
    },
    () => {
      const ladder = GRANULARITIES[metricFunction] ?? COUNTER_GRANULARITIES;
      return ladder.getInterval(getDiffInMinutes(datetimeObj));
    }
  );

  return interval;
}

type GranularityLookup = {
  [metricName: string]: GranularityLadder;
};

const GRANULARITIES: GranularityLookup = {};

function registerGranularities(
  spanFunctionNames: readonly string[],
  granularities: GranularityLadder
) {
  spanFunctionNames.forEach(spanFunctionName => {
    GRANULARITIES[spanFunctionName] = granularities;
  });
}

registerGranularities(COUNTER_AGGREGATES, COUNTER_GRANULARITIES);
registerGranularities(DISTRIBUTION_AGGREGATES, DISTRIBUTION_GRANULARITIES);
registerGranularities(SPAN_FUNCTIONS, COUNTER_GRANULARITIES);
