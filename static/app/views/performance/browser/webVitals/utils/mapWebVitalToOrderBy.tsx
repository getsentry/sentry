import {getAggregateAlias} from 'sentry/utils/discover/fields';
import type {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import type {WebVitalsAggregateFunction} from 'sentry/views/performance/browser/webVitals/utils/useAggregateFunction';

export const mapWebVitalToOrderBy = (
  webVital?: WebVitals | null,
  aggregateFunction?: WebVitalsAggregateFunction
) => {
  let webVitalKey = webVital ? WEBVITAL_TO_KEY[webVital] : undefined;
  if (!webVitalKey) {
    return undefined;
  }
  if (aggregateFunction) {
    webVitalKey = getAggregateAlias(`${aggregateFunction}(${webVitalKey})`);
  }
  return `-${webVitalKey}`;
};

const WEBVITAL_TO_KEY = {
  lcp: 'measurements.lcp',
  fcp: 'measurements.fcp',
  cls: 'measurements.cls',
  ttfb: 'measurements.ttfb',
  fid: 'measurements.fid',
};
