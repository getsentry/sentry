import {createDurationFormatter} from '@sentry/scraps/duration';

import {pgettext, t, tn} from 'sentry/locale';

export const durationFormatter = createDurationFormatter({t, tn, pgettext});

/** Preserve the application's positional formatting contract. */
export function getDuration(
  seconds: number,
  fixedDigits = 0,
  abbreviation = false,
  extraShort = false,
  absolute = false,
  minimumUnit = 1
): string {
  return durationFormatter(seconds, {
    precision: fixedDigits,
    style: extraShort ? 'narrow' : abbreviation ? 'short' : 'regular',
    absolute,
    minimumUnit,
  });
}
