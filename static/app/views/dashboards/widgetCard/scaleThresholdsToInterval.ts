import {defined} from 'sentry/utils/defined';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import type {ThresholdsConfig} from 'sentry/views/dashboards/widgetBuilder/buildSteps/thresholdsStep/thresholds';

export function scaleThresholdsToInterval(
  thresholds: ThresholdsConfig,
  interval?: string
): ThresholdsConfig {
  if (!thresholds.timePeriod || !interval) {
    return thresholds;
  }

  const thresholdPeriodHours = parsePeriodToHours(thresholds.timePeriod);
  const intervalHours = parsePeriodToHours(interval);

  if (thresholdPeriodHours <= 0 || intervalHours <= 0) {
    return thresholds;
  }

  const scale = intervalHours / thresholdPeriodHours;
  const maxValues = {...thresholds.max_values};

  if (defined(maxValues.max1)) {
    maxValues.max1 *= scale;
  }
  if (defined(maxValues.max2)) {
    maxValues.max2 *= scale;
  }

  return {
    ...thresholds,
    max_values: maxValues,
  };
}
