import {getAggregateAlias} from 'sentry/utils/discover/fields';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';

export const mapWebVitalToOrderBy = (
  webVital?: WebVitals | null,
  aggregateFunction?: 'avg' | 'p75'
) => {
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
