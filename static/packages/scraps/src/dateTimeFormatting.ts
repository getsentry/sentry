function getDateFormat({year}: {year?: boolean}) {
  // "Jan 1, 2022" or "Jan 1"
  return year ? 'MMM D, YYYY' : 'MMM D';
}

/**
 * Get a common time format
 */
export function getTimeFormat({
  clock24Hours,
  seconds,
  timeZone,
  milliseconds,
}: {
  clock24Hours?: boolean;
  milliseconds?: boolean;
  seconds?: boolean;
  timeZone?: boolean;
} = {}) {
  let format = '';

  if (clock24Hours ?? false) {
    if (milliseconds) {
      format = 'HH:mm:ss.SSS';
    } else {
      format = seconds ? 'HH:mm:ss' : 'HH:mm';
    }
  } else {
    if (milliseconds) {
      format = 'h:mm:ss.SSS A';
    } else {
      format = seconds ? 'LTS' : 'LT';
    }
  }

  if (timeZone) {
    format += ' z';
  }

  return format;
}

export interface DateTimeFormatOptions {
  /**
   * Whether to use a 24 hour clock. Defaults to a 12 hour clock.
   */
  clock24Hours?: boolean;
  /**
   * If true, will only return the date part, e.g. "Jan 1".
   */
  dateOnly?: boolean;
  /**
   * Whether to show the milliseconds.
   */
  milliseconds?: boolean;
  /**
   * Whether to show the seconds.
   */
  seconds?: boolean;
  /**
   * If true, will only return the time part, e.g. "2:50 PM"
   */
  timeOnly?: boolean;
  /**
   * Whether to show the time zone.
   */
  timeZone?: boolean;
  /**
   * Whether to show the year. If not specified, the returned date string will
   * not contain the year _if_ the date is not in the current calendar year.
   * For example: "Feb 1" (2022), "Jan 1" (2022), "Dec 31, 2021".
   */
  year?: boolean;
}

export function getFormat({
  dateOnly,
  timeOnly,
  year,
  seconds,
  timeZone,
  clock24Hours,
  milliseconds,
}: DateTimeFormatOptions = {}) {
  if (dateOnly) {
    return getDateFormat({year});
  }

  if (timeOnly) {
    return getTimeFormat({clock24Hours, seconds, timeZone});
  }

  const dateFormat = getDateFormat({year});
  const timeFormat = getTimeFormat({
    clock24Hours,
    seconds,
    milliseconds,
    timeZone,
  });

  // If the year is shown, then there's already a comma in dateFormat ("Jan 1, 2020"),
  // so we don't need to add another comma between the date and time
  return year ? `${dateFormat} ${timeFormat}` : `${dateFormat}, ${timeFormat}`;
}
