import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import isNumber from 'lodash/isNumber';
import moment from 'moment-timezone';

import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {getDuration} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import {ColorOrAlias} from 'sentry/utils/theme';

function getDateObj(date: RelaxedDateType): Date {
  return typeof date === 'string' || isNumber(date) ? new Date(date) : date;
}

type RelaxedDateType = string | number | Date;

type UnitStyle = 'human' | 'regular' | 'short' | 'extraShort';

interface Props extends React.TimeHTMLAttributes<HTMLTimeElement> {
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
   * Tooltip text to be hoverable when isTooltipHoverable is true
   */
  isTooltipHoverable?: boolean;
  /**
   * How often should the component live update the timestamp.
   *
   * You may specify a custom interval in milliseconds if necissary.
   *
   * @default minute
   */
  liveUpdateInterval?: 'minute' | 'second' | number;
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
   * Suffix content to add to the tooltip. Useful to indicate what the relative
   * time is for
   */
  tooltipSuffix?: React.ReactNode;
  /**
   * Change the color of the underline
   */
  tooltipUnderlineColor?: ColorOrAlias;
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
   * NOTE: shot and extraShort do NOT currently support times in the future.
   *
   * @default human
   */
  unitStyle?: UnitStyle;
}

function TimeSince({
  date,
  disabledAbsoluteTooltip,
  tooltipShowSeconds,
  tooltipPrefix: tooltipTitle,
  tooltipBody,
  tooltipSuffix,
  tooltipUnderlineColor,
  isTooltipHoverable = false,
  unitStyle,
  prefix = t('in'),
  suffix = t('ago'),
  liveUpdateInterval = 'minute',
  ...props
}: Props) {
  const tickerRef = useRef<number | undefined>();

  const computeRelativeDate = useCallback(
    () => getRelativeDate(date, suffix, prefix, unitStyle),
    [date, suffix, prefix, unitStyle]
  );

  const [relative, setRelative] = useState<string>(computeRelativeDate());

  useEffect(() => {
    // Immediately update if props change
    setRelative(computeRelativeDate());

    const interval =
      liveUpdateInterval === 'minute'
        ? 60 * 1000
        : liveUpdateInterval === 'second'
        ? 1000
        : liveUpdateInterval;

    // Start a ticker to update the relative time
    tickerRef.current = window.setInterval(
      () => setRelative(computeRelativeDate()),
      interval
    );

    return () => window.clearInterval(tickerRef.current);
  }, [liveUpdateInterval, computeRelativeDate]);

  const dateObj = getDateObj(date);
  const user = ConfigStore.get('user');
  const options = user ? user.options : null;

  // Use short months when showing seconds, because "September" causes the
  // tooltip to overflow.
  const tooltipFormat = tooltipShowSeconds
    ? 'MMM D, YYYY h:mm:ss A z'
    : 'MMMM D, YYYY h:mm A z';
  const format = options?.clock24Hours ? 'MMMM D, YYYY HH:mm z' : tooltipFormat;

  const tooltip = getDynamicText({
    fixed: options?.clock24Hours
      ? 'November 3, 2020 08:57 UTC'
      : 'November 3, 2020 8:58 AM UTC',
    value: moment.tz(dateObj, options?.timezone ?? '').format(format),
  });

  return (
    <Tooltip
      disabled={disabledAbsoluteTooltip}
      underlineColor={tooltipUnderlineColor}
      showUnderline
      isHoverable={isTooltipHoverable}
      title={
        <Fragment>
          {tooltipTitle && <div>{tooltipTitle}</div>}
          {tooltipBody ?? tooltip}
          {tooltipSuffix && <div>{tooltipSuffix}</div>}
        </Fragment>
      }
    >
      <time dateTime={dateObj?.toISOString()} {...props}>
        {relative}
      </time>
    </Tooltip>
  );
}

export default TimeSince;

function getRelativeDate(
  currentDateTime: RelaxedDateType,
  suffix?: string,
  prefix?: string,
  unitStyle: UnitStyle = 'human'
): string {
  const momentDate = moment(getDateObj(currentDateTime));
  const isFuture = momentDate.isAfter(moment());

  let deltaText: string = '';

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
