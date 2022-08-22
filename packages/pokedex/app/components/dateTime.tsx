import moment from 'moment';
import momentTimezone from 'moment-timezone';

import ConfigStore from 'sentry/stores/configStore';

interface Props extends React.HTMLAttributes<HTMLTimeElement> {
  /**
   * Input date.
   */
  date: moment.MomentInput | momentTimezone.MomentInput;
  /**
   * If true, will only return the date part, e.g. "Jan 1".
   */
  dateOnly?: boolean;
  /**
   * Formatting string. If specified, this formatting string will override all
   * other formatting props (dateOnly, timeOnly, year).
   */
  format?: string;
  /**
   * Whether to show the seconds. Is false by default.
   */
  seconds?: boolean;
  /**
   * If true, will only return the time part, e.g. "2:50 PM"
   */
  timeOnly?: boolean;
  /**
   * Whether to show the time zone. If not specified, the returned date string
   * will not contain the time zone _unless_ the time is UTC, in which case
   * the user would want to know that it's UTC and not their own time zone.
   */
  timeZone?: boolean;
  /**
   * Whether the date input is UTC time or not.
   */
  utc?: boolean;
  /**
   * Whether to show the year. If not specified, the returned date string will
   * not contain the year _if_ the date is not in the current calendar year.
   * For example: "Feb 1" (2022), "Jan 1" (2022), "Dec 31, 2021".
   */
  year?: boolean;
}

function getDateFormat({year}: Pick<Props, 'year'>) {
  // "Jan 1, 2022" or "Jan 1"
  return year ? 'MMM D, YYYY' : 'MMM D';
}

function getTimeFormat({clock24Hours, seconds, timeZone}) {
  const substrings = [
    clock24Hours ? 'HH' : 'h', // hour – "23" (24h format) or "11" (12h format)
    ':mm', // minute
    seconds ? ':ss' : '', // second
    clock24Hours ? '' : ' A', // AM/PM
    timeZone ? ' z' : '', // time zone
  ];
  return substrings.join('');
}

function getFormat({
  dateOnly,
  timeOnly,
  year,
  seconds,
  timeZone,
  clock24Hours,
}: Pick<Props, 'dateOnly' | 'timeOnly' | 'year' | 'seconds' | 'timeZone'> & {
  clock24Hours: boolean;
}) {
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
    timeZone,
  });

  // If the year is shown, then there's already a comma in dateFormat ("Jan 1, 2020"),
  // so we don't need to add another comma between the date and time
  return year ? `${dateFormat} ${timeFormat}` : `${dateFormat}, ${timeFormat}`;
}

function DateTime({
  format,
  date,
  utc,
  dateOnly,
  timeOnly,
  year,
  timeZone,
  seconds = false,
  ...props
}: Props) {
  const user = ConfigStore.get('user');
  const options = user?.options;

  const formatString =
    format ??
    getFormat({
      dateOnly,
      timeOnly,
      // If the year prop is defined, then use it. Otherwise only show the year if `date`
      // is in the current year.
      year: year ?? moment().year() !== moment(date).year(),
      // If timeZone is defined, use it. Otherwise only show the time zone if we're using
      // UTC time.
      timeZone: timeZone ?? utc,
      seconds,
      ...options,
    });

  return (
    <time {...props}>
      {utc
        ? moment.utc(date as moment.MomentInput).format(formatString)
        : momentTimezone.tz(date, options?.timezone ?? '').format(formatString)}
    </time>
  );
}

export default DateTime;
