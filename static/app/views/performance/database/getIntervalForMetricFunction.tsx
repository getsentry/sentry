import {
  DateTimeObject,
  getDiffInMinutes,
  GranularityLadder,
} from 'sentry/components/charts/utils';
import {
  COUNTER_GRANULARITIES,
  DISTRIBUTION_GRANULARITIES,
} from 'sentry/views/performance/database/settings';
import {
  Aggregate,
  COUNTER_AGGREGATES,
  DISTRIBUTION_AGGREGATES,
  SPAN_FUNCTIONS,
  SpanFunctions,
} from 'sentry/views/starfish/types';

export function getIntervalForMetricFunction(
  metricFunction: Aggregate | SpanFunctions | string,
  datetimeObj: DateTimeObject
) {
  const ladder = GRANULARITIES[metricFunction] ?? COUNTER_GRANULARITIES;
  return ladder.getInterval(getDiffInMinutes(datetimeObj));
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
