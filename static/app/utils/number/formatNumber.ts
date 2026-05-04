import {NUMBER_MAX_FRACTION_DIGITS} from 'sentry/views/dashboards/widgets/common/settings';

import {formatFloat} from './formatFloat';

export function formatNumber(value: number) {
  if (value >= 10_000_000_000_000) {
    return value;
  }

  return formatFloat(value, NUMBER_MAX_FRACTION_DIGITS).toLocaleString(undefined, {
    maximumFractionDigits: NUMBER_MAX_FRACTION_DIGITS,
  });
}
