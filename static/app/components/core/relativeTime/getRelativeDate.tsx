import isNumber from 'lodash/isNumber';
import moment from 'moment-timezone';

import {getDuration} from 'sentry/utils/duration/getDuration';

export type RelaxedDateType = string | number | Date;

/**
 * How much text should be used for the relative time's units:
 *
 * human:
 *   hour, minute, second. Uses 'human' fuzzy formatting for values such as 'a
 *   minute' or 'a few seconds'. (This is the default)
 *
 * regular:
 *   Shows the full units (hours, minutes, seconds)
 *
 * short:
 *   Like regular but uses shorter units (hr, min, sec)
 *
 * extraShort:
 *   Like short but uses very short units (h, m, s)
 *
 * NOTE: short and extraShort do NOT currently support times in the future.
 */
export type UnitStyle = 'human' | 'regular' | 'short' | 'extraShort';

export function getDateObj(date: RelaxedDateType): Date {
  return typeof date === 'string' || isNumber(date) ? new Date(date) : date;
}

/**
 * How long ago a date was, or how long until it arrives.
 *
 * Lives here rather than beside `TimeSince` so that `RelativeTime` and
 * `TimeSince` can both reach it without importing each other.
 */
export function getRelativeDate(
  currentDateTime: RelaxedDateType,
  suffix?: string,
  prefix?: string,
  unitStyle: UnitStyle = 'human'
): string {
  const momentDate = moment(getDateObj(currentDateTime));
  const isFuture = momentDate.isAfter(moment());

  let deltaText = '';

  if (unitStyle === 'human') {
    // Moment provides a nice human relative date that uses "a few" for various units
    deltaText = momentDate.fromNow(true);
  } else {
    deltaText = getDuration(
      moment().diff(momentDate, 'seconds'),
      0,
      unitStyle === 'short',
      unitStyle === 'extraShort',
      isFuture
    );
  }

  // Only one of the two is used, so the other being absent is not a reason to
  // drop the affix that does apply.
  if (isFuture) {
    return prefix ? `${prefix} ${deltaText}` : deltaText;
  }

  return suffix ? `${deltaText} ${suffix}` : deltaText;
}
