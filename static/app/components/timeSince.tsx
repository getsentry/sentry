import {Fragment, useEffect, useMemo, useState} from 'react';
import isNumber from 'lodash/isNumber';
import moment from 'moment-timezone';

import {InfoText, type InfoTextProps} from '@sentry/scraps/info';

import {t} from 'sentry/locale';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {useUser} from 'sentry/utils/useUser';

import {useTimezone} from './timezoneProvider';

function getDateObj(date: RelaxedDateType): Date {
  return typeof date === 'string' || isNumber(date) ? new Date(date) : date;
}

type RelaxedDateType = string | number | Date;

type UnitStyle = 'human' | 'regular' | 'short' | 'extraShort';

interface Props extends Omit<
  React.TimeHTMLAttributes<HTMLTimeElement>,
  'color' | 'title'
> {
  /**
   * The date value, can be string, number (e.g. timestamp), or instance of Date
   *
   * May be in the future
   */
  date: RelaxedDateType;
  /**
   * By default we show tooltip with absolute date on hover, this prop disables
   * that
   */
  disabledAbsoluteTooltip?: boolean;
  /**
   * How often should the component live update the timestamp.
   *
   * You may specify a custom interval in milliseconds if necissary.
   *
   * @default minute
   */
  liveUpdateInterval?: 'minute' | 'second' | number;
  /**
   * Max width of the tooltip
   */
  maxWidth?: InfoTextProps<'time'>['maxWidth'];
  /**
   * Prefix before upcoming time (when the date is in the future)
   *
   * @default "in"
   */
  prefix?: string;
  /**
   * Suffix after elapsed time e.g. "ago" in "5 minutes ago"
   *
   * @default "ago"
   */
  suffix?: string;
  /**
   * Customize the tooltip content. This replaces the long form of the timestamp
   * completely.
   */
  tooltipBody?: React.ReactNode;
  /**
   * Prefix content to add to the tooltip. Useful to indicate what the relative
   * time is for
   */
  tooltipPrefix?: React.ReactNode;
  /**
   * Include seconds in the tooltip
   */
  tooltipShowSeconds?: boolean;
  /**
   * How much text should be used for the suffix:
   *
   * human:
   *   hour, minute, second. Uses 'human' fuzzy foormatting for values such as 'a
   *   minute' or 'a few seconds'. (This is the default)
   *
   * regular:
   *   Shows the full units (hours, minutes, seconds)
   *
   * short:
   *   Like exact but uses shorter units (hr, min, sec)
   *
   * extraShort:
   *   Like short but uses very short units (h, m, s)
   *
   * NOTE: short and extraShort do NOT currently support times in the future.
   *
   * @default human
   */
  unitStyle?: UnitStyle;
  /**
   * Change the color of the underline
   */
  variant?: InfoTextProps<'time'>['variant'];
}

export function TimeSince({
  date,
  disabledAbsoluteTooltip,
  tooltipShowSeconds,
  tooltipPrefix: tooltipTitle,
  tooltipBody,
  variant = 'inherit',
  maxWidth,
  unitStyle,
  prefix = t('in'),
  suffix = t('ago'),
  liveUpdateInterval = 'minute',
  ...props
}: Props) {
  const user = useUser();
  const tz = useTimezone();

  // Counter to trigger periodic re-computation of relative time
  const [tick, setTick] = useState(0);

  const relative = useMemo(() => {
    void tick; // Ensure recomputation when tick changes
    return getRelativeDate(date, suffix, prefix, unitStyle);
  }, [date, suffix, prefix, unitStyle, tick]);

  useEffect(() => {
    const interval =
      liveUpdateInterval === 'minute'
        ? 60 * 1000
        : liveUpdateInterval === 'second'
          ? 1000
          : liveUpdateInterval;

    // Start a ticker to update the relative time
    const ticker = window.setInterval(() => setTick(prev => prev + 1), interval);

    return () => window.clearInterval(ticker);
  }, [liveUpdateInterval]);

  const dateObj = getDateObj(date);
  const options = user ? user.options : null;

  // Use short months when showing seconds, because "September" causes the
  // tooltip to overflow.
  const tooltipFormat = tooltipShowSeconds
    ? 'MMM D, YYYY h:mm:ss A z'
    : 'MMMM D, YYYY h:mm A z';
  const format = options?.clock24Hours ? 'MMMM D, YYYY HH:mm z' : tooltipFormat;

  const tooltip = moment.tz(dateObj, tz).format(format);

  return (
    <InfoText
      as="time"
      dateTime={dateObj?.toISOString()}
      variant={variant}
      maxWidth={maxWidth}
      title={
        disabledAbsoluteTooltip ? null : (
          <Fragment>
            {tooltipTitle && <div>{tooltipTitle}</div>}
            {tooltipBody ?? tooltip}
          </Fragment>
        )
      }
      {...props}
    >
      {relative}
    </InfoText>
  );
}

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

  if (!suffix && !prefix) {
    return deltaText;
  }

  return isFuture ? `${prefix} ${deltaText}` : `${deltaText} ${suffix}`;
}
