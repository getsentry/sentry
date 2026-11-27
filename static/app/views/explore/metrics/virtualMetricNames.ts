import {ORDER, type WebVitals} from 'sentry/views/insights/browser/webVitals/types';

/**
 * Names of the web vital metrics and of the score attribute each one carries.
 * Imports nothing from `sentry/utils/discover/fields`, which uses
 * `findVirtualTraceMetricName` to label aggregates.
 */

export function webVitalMetricName(vital: WebVitals) {
  return `browser.web_vital.${vital}`;
}

export function webVitalScoreMetricName(vital: WebVitals) {
  return `${webVitalMetricName(vital)}.score`;
}

export function webVitalScoreAttribute(vital: WebVitals) {
  return `tags[score.ratio.${vital},number]`;
}

/**
 * The name of the virtual metric an aggregate stands for, given the attribute
 * it reads and the name of the stored metric it reads it from.
 */
export function findVirtualTraceMetricName(
  attribute: string,
  sourceName: string
): string | undefined {
  const vital = ORDER.find(
    v => attribute === webVitalScoreAttribute(v) && sourceName === webVitalMetricName(v)
  );
  return vital === undefined ? undefined : webVitalScoreMetricName(vital);
}
