import {useEffect, useMemo, useState} from 'react';

import {InfoText, type InfoTextProps} from '@sentry/scraps/info';
import {
  getDateObj,
  getRelativeDate,
  type RelaxedDateType,
  RELATIVE_TIME_MAX_WIDTH,
  RelativeTime,
  type UnitStyle,
} from '@sentry/scraps/relativeTime';

import {t} from 'sentry/locale';

export {getRelativeDate};

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
   * Customize the tooltip content. This replaces the `RelativeTime` card
   * completely, so `tooltipPrefix` has nothing left to label and is ignored.
   */
  tooltipBody?: React.ReactNode;
  /**
   * What the timestamp refers to, e.g. "Last Seen". Becomes the card's header,
   * alongside the same relative time the trigger shows. Without one the card is
   * the timezone rows on their own.
   *
   * Has no effect alongside `tooltipBody`, which replaces the card it heads.
   */
  tooltipPrefix?: React.ReactNode;
  /**
   * Include seconds in the tooltip
   */
  tooltipShowSeconds?: boolean;
  /**
   * How much text should be used for the suffix.
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
  tooltipPrefix,
  tooltipBody,
  variant = 'inherit',
  maxWidth,
  unitStyle,
  prefix = t('in'),
  suffix = t('ago'),
  liveUpdateInterval = 'minute',
  ...props
}: Props) {
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

  // A caller that supplies its own body owns the whole overlay, so the card's
  // width does not apply to it.
  const showsCard = !tooltipBody;

  return (
    <InfoText
      as="time"
      dateTime={dateObj?.toISOString()}
      variant={variant}
      maxWidth={maxWidth ?? (showsCard ? RELATIVE_TIME_MAX_WIDTH : undefined)}
      title={
        disabledAbsoluteTooltip
          ? null
          : (tooltipBody ?? (
              <RelativeTime
                date={date}
                label={tooltipPrefix}
                prefix={prefix}
                suffix={suffix}
                unitStyle={unitStyle}
                showSeconds={tooltipShowSeconds}
              />
            ))
      }
      {...props}
    >
      {relative}
    </InfoText>
  );
}
