import type * as React from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {DateTime} from '@sentry/scraps/dateTime';
import {DescriptionList} from '@sentry/scraps/descriptionList';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {useFormattingSnapshot} from '../dateTime/context';
import {formatTimezone} from '../dateTime/format';
import {parseDate} from '../dateTime/parseDate';

import {
  formatRelativeDate,
  type RelaxedDateType,
  type RelativeTimeOptions,
} from './getRelativeDate';

/** Allow room for offset labels such as GMT+5:45 without wrapping timestamp rows. */
export const RELATIVE_TIME_MAX_WIDTH = 280;

/**
 * Timezone abbreviations are not prose, so they are not translated.
 */
const UTC = 'UTC';

export interface RelativeTimeProps extends RelativeTimeOptions {
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
  rounding,
  style,
  showSeconds,
}: RelativeTimeProps) {
  const snapshot = useFormattingSnapshot();
  const value = parseDate(date, snapshot.timezone);
  const abbreviation = value
    ? formatTimezone(value.epochMilliseconds, snapshot.timezone, snapshot.locale)
    : 'Invalid date';
  // Zones that resolve to UTC itself would render the second row identically to
  // the first. Zones that merely share its offset right now (GMT, and BST's
  // winter half) keep both rows, because the differing label is the useful part.
  const isViewerUtc = abbreviation === UTC;

  return (
    <Fragment>
      {label != null && (
        <Tooltip.Header
          trailingItems={formatRelativeDate(
            date,
            {suffix, prefix, rounding, style},
            snapshot
          )}
        >
          {label}
        </Tooltip.Header>
      )}
      <Tooltip.Grid>
        <DescriptionList
          columns="max-content 1fr max-content"
          gap="2xs sm"
          align="center"
        >
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
        </DescriptionList>
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
    <Fragment>
      <DescriptionList.Term>
        <TimezoneTag variant={variant}>{abbreviation}</TimezoneTag>
      </DescriptionList.Term>
      <DescriptionList.Details>
        <Text tabular wrap="nowrap">
          <DateTime
            date={date}
            mode="date"
            year="always"
            timezone={utc ? 'UTC' : undefined}
            showTimezone={false}
          />
        </Text>
      </DescriptionList.Details>
      <DescriptionList.Details>
        {/* Pinned right so the times form a column against the dates. The list
            already reads from the left, so only this cell states an alignment. */}
        <Text align="right" tabular wrap="nowrap">
          <DateTime
            date={date}
            mode="time"
            precision={showSeconds ? 'second' : 'minute'}
            timezone={utc ? 'UTC' : undefined}
            showTimezone={false}
          />
        </Text>
      </DescriptionList.Details>
    </Fragment>
  );
}

/**
 * The design's timezone pill is smaller than the default `Tag` — 4px of
 * horizontal padding rather than 8px, which is what keeps the three columns
 * inside the card's width. The pill stretches to the column, which is as wide
 * as the widest abbreviation, so its text is centred to keep a shorter one like
 * `UTC` off the left edge. Only the geometry is overridden; the colors still come
 * from the `variant` tokens.
 */
const TimezoneTag = styled(Tag)`
  height: 17px;
  min-width: 20px;
  justify-content: center;
  padding: 0 ${p => p.theme.space.xs};
  border-radius: ${p => p.theme.radius['2xs']};
`;
