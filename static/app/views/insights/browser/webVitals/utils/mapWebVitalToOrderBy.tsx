import {getAggregateAlias} from 'sentry/utils/discover/fields';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';

export const mapWebVitalToOrderBy = (
  webVital?: WebVitals | null,
  aggregateFunction?: 'avg' | 'p75'
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
};
