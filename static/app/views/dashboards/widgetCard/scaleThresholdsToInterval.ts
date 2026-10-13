import {defined} from 'sentry/utils/defined';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import type {ThresholdsConfig} from 'sentry/views/dashboards/widgetBuilder/buildSteps/thresholdsStep/thresholds';

export function scaleThresholdsToInterval(
  thresholds: ThresholdsConfig,
  interval?: string
): ThresholdsConfig {
  if (!thresholds.timeWindow || !interval) {
    return thresholds;
  }

  const thresholdTimeWindowHours = parsePeriodToHours(thresholds.timeWindow);
  const intervalHours = parsePeriodToHours(interval);

  if (thresholdTimeWindowHours <= 0 || intervalHours <= 0) {
    return thresholds;
  }

  const scale = intervalHours / thresholdTimeWindowHours;
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
