import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import moment from 'moment-timezone';

import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {getDuration} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import {ColorOrAlias} from 'sentry/utils/theme';

import Tooltip from './tooltip';

const ONE_MINUTE_IN_MS = 60000;

function getDateObj(date: RelaxedDateType): Date {
  return isString(date) || isNumber(date) ? new Date(date) : date;
}

type RelaxedDateType = string | number | Date;

interface Props extends React.TimeHTMLAttributes<HTMLTimeElement> {
  /**
   * The date value, can be string, number (e.g. timestamp), or instance of Date
   */
  date: RelaxedDateType;
  /**
   * By default we show tooltip with absolute date on hover, this prop disables
   * that
   */
  disabledAbsoluteTooltip?: boolean;
  /**
   * Shortens the shortened relative time
   * min to m, hr to h
   */
  extraShort?: boolean;
  /**
   * For relative time shortens minutes to min, hour to hr etc.
   */
  shorten?: boolean;
  /**
   * Suffix after elapsed time e.g. "ago" in "5 minutes ago"
   */
  suffix?: string;

  tooltipShowSeconds?: boolean;
  tooltipTitle?: React.ReactNode;
  tooltipUnderlineColor?: ColorOrAlias;
}

function TimeSince({
  date,
  suffix = t('ago'),
  disabledAbsoluteTooltip,
  tooltipShowSeconds,
  tooltipTitle,
  tooltipUnderlineColor,
  shorten,
  extraShort,
  ...props
}: Props) {
  const tickerRef = useRef<number | undefined>();

  const computeRelativeDate = useCallback(
    () => getRelativeDate(date, suffix, shorten, extraShort),
    [date, suffix, shorten, extraShort]
  );

  const [relative, setRelative] = useState<string>(computeRelativeDate());

  useEffect(() => {
    // Immediately update if props change
    setRelative(computeRelativeDate());

    // Start a ticker to update the relative time
    tickerRef.current = window.setTimeout(
      () => setRelative(computeRelativeDate()),
      ONE_MINUTE_IN_MS
    );

    return () => window.clearTimeout(tickerRef.current);
  }, [computeRelativeDate]);

  const dateObj = getDateObj(date);
  const user = ConfigStore.get('user');
  const options = user ? user.options : null;
  // Use short months when showing seconds, because "September" causes the tooltip to overflow.
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
      title={
        <Fragment>
          {tooltipTitle && <div>{tooltipTitle}</div>}
          {tooltip}
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

export function getRelativeDate(
  currentDateTime: RelaxedDateType,
  suffix?: string,
  shorten?: boolean,
  extraShort?: boolean
): string {
  const date = getDateObj(currentDateTime);

  if ((shorten || extraShort) && suffix) {
    return t('%(time)s %(suffix)s', {
      time: getDuration(moment().diff(moment(date), 'seconds'), 0, shorten, extraShort),
      suffix,
    });
  }
  if ((shorten || extraShort) && !suffix) {
    return getDuration(moment().diff(moment(date), 'seconds'), 0, shorten, extraShort);
  }
  if (!suffix) {
    return moment(date).fromNow(true);
  }
  if (suffix === 'ago') {
    return moment(date).fromNow();
  }

  return t('%(time)s %(suffix)s', {time: moment(date).fromNow(true), suffix});
}
