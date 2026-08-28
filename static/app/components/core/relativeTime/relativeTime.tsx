import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {useTimezone} from '@sentry/scraps/datetime';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';
import {useTranslation} from '@sentry/scraps/translationContext';

import {DateTime} from 'sentry/components/dateTime';
import {defined} from 'sentry/utils/defined';

import {getRelativeDate, type RelaxedDateType, type UnitStyle} from './getRelativeDate';

/**
 * Most timezone abbreviations are three or four characters. Zones without an
 * abbreviation format as a five character offset instead (`+0545`, `+1245`),
 * and the rows do not wrap, so the card is allowed to grow to this rather than
 * spill outside its own border.
 */
export const RELATIVE_TIME_MAX_WIDTH = 280;

/**
 * Timezone abbreviations are not prose, so they are not translated.
 */
const UTC = 'UTC';

interface RelativeTimeProps {
  /**
   * The date value, can be string, number (e.g. timestamp), or instance of Date
   */
  date: RelaxedDateType;
  /**
   * What the timestamp refers to, e.g. "Last Seen". Rendered in a header
   * alongside the relative time.
   *
   * Optional because most timestamps in the app are already labelled by what
   * they sit next to. Without one there is no header, and the card is the two
   * timezone rows on their own.
   */
  label?: React.ReactNode;
  /**
   * Prefix before upcoming time (when the date is in the future)
   *
   * @default "in"
   */
  prefix?: string;
  /**
   * Show seconds on the absolute times. For timestamps precise enough that the
   * minute alone does not identify them, e.g. spans in a trace.
   */
  showSeconds?: boolean;
  /**
   * Suffix after elapsed time e.g. "ago" in "5 minutes ago"
   *
   * @default "ago"
   */
  suffix?: string;
  /**
   * How much text should be used for the relative time's units. Should match
   * the trigger it is shown for, so both read the same.
   */
  unitStyle?: UnitStyle;
}

/**
 * A detail card for a single timestamp, showing the relative time alongside the
 * absolute time in both the viewer's timezone and UTC.
 *
 * This is tooltip content rather than a standalone element. `TimeSince` renders
 * it for you; reach for it directly only when you are building the tooltip
 * yourself. The overlay drops its own padding on seeing the sections this
 * composes, so there is nothing to pass but the card's width:
 *
 * ```tsx
 * <Tooltip
 *   maxWidth={RELATIVE_TIME_MAX_WIDTH}
 *   title={<RelativeTime date={date} label={t('Last Seen')} />}
 * >
 *   {trigger}
 * </Tooltip>
 * ```
 */
export function RelativeTime({
  date,
  label,
  prefix,
  suffix,
  unitStyle,
  showSeconds,
}: RelativeTimeProps) {
  const timezone = useTimezone();
  const {t} = useTranslation();

  // Defaulted to match <TimeSince>, so a card that omits them reads the same as
  // the trigger that also omitted them. Resolved here rather than as default
  // parameters because the words come from a provider.
  const resolvedPrefix = prefix ?? t('in');
  const resolvedSuffix = suffix ?? t('ago');

  const abbreviation = moment.tz(date, timezone).format('z');
  // Zones that resolve to UTC itself would render the second row identically to
  // the first. Zones that merely share its offset right now (GMT, and BST's
  // winter half) keep both rows, because the differing label is the useful part.
  const isViewerUtc = abbreviation === UTC;

  return (
    <Fragment>
      {defined(label) && (
        <Tooltip.Header
          trailingItems={getRelativeDate(date, resolvedSuffix, resolvedPrefix, unitStyle)}
        >
          {label}
        </Tooltip.Header>
      )}
      <Tooltip.Grid columns="max-content 1fr max-content">
        {!isViewerUtc && (
          <TimestampRow
            date={date}
            abbreviation={abbreviation}
            variant="info"
            showSeconds={showSeconds}
          />
        )}
        <TimestampRow
          date={date}
          abbreviation={UTC}
          variant="muted"
          showSeconds={showSeconds}
          utc
        />
      </Tooltip.Grid>
    </Fragment>
  );
}

/**
 * One row of the card: the timezone pill, then the date and time in it. The
 * cells go straight into the grid, so the columns stay aligned across rows when
 * one abbreviation is wider than the other.
 */
function TimestampRow({
  date,
  abbreviation,
  variant,
  showSeconds,
  utc,
}: {
  abbreviation: string;
  date: RelativeTimeProps['date'];
  variant: React.ComponentProps<typeof Tag>['variant'];
  showSeconds?: boolean;
  utc?: boolean;
}) {
  return (
    <Tooltip.Row
      leadingItems={<TimezoneTag variant={variant}>{abbreviation}</TimezoneTag>}
      trailingItems={
        // Pinned right so the times form a column against the dates. The grid
        // already reads from the left, so only this cell states an alignment.
        <Text align="right" tabular wrap="nowrap">
          <DateTime
            date={date}
            timeOnly
            seconds={showSeconds}
            utc={utc}
            timeZone={false}
          />
        </Text>
      }
    >
      <Text tabular wrap="nowrap">
        <DateTime date={date} dateOnly year utc={utc} timeZone={false} />
      </Text>
    </Tooltip.Row>
  );
}

/**
 * The design's timezone pill is smaller than the default `Tag` — 4px of
 * horizontal padding rather than 8px, which is what keeps the three columns
 * inside the card's width. Only the geometry is overridden; the colors still
 * come from the `variant` tokens.
 */
const TimezoneTag = styled(Tag)`
  height: 17px;
  min-width: 20px;
  padding: 0 ${p => p.theme.space.xs};
  border-radius: ${p => p.theme.radius['2xs']};
`;
