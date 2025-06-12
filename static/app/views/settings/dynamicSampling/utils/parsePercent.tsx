import {clampPercentRate} from 'sentry/views/settings/dynamicSampling/utils/clampNumer';

export function parsePercent(value: string | undefined | null, fallback = 0) {
  if (!value) {
    return fallback;
  }

  const numericValue = parseFloat(value);
  if (Number.isNaN(numericValue)) {
    return fallback;
  }

  return clampPercentRate(numericValue / 100);
}
