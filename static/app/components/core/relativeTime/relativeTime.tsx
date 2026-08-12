import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Grid} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {getRelativeDate, type UnitStyle} from 'sentry/components/timeSince';
import {useTimezone} from 'sentry/components/timezoneProvider';
import {t} from 'sentry/locale';

/**
 * The card is designed at 240px, border included.
 */
const WIDTH = 240;

/**
 * Most timezone abbreviations are three or four characters, which is what 240px
 * is budgeted for. Zones without an abbreviation format as a five character
 * offset instead (`+0545`, `+1245`), and the rows do not wrap, so the card is
 * allowed to grow rather than spill outside its own border.
 */
const MAX_WIDTH = 280;

/**
 * Tooltip props required to render <RelativeTime> at its designed size. Only
 * the width needs to come from the tooltip — the overlay's default `max-width`
 * of 225px would otherwise clamp the card and force its rows to overflow.
 *
 * Everything else the card needs, it applies to itself. Adopting the card
 * never restyles the overlay, so it cannot affect any other tooltip.
 */
export const RELATIVE_TIME_TOOLTIP_PROPS = {
  maxWidth: MAX_WIDTH,
} satisfies {maxWidth: number};

interface RelativeTimeProps {
  /**
   * The date value, can be string, number (e.g. timestamp), or instance of Date
   */
  date: string | number | Date;
  /**
   * What the timestamp refers to, e.g. "Last Seen". Rendered in the header
   * alongside the relative time.
   */
  label: React.ReactNode;
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
   * How much text should be used for the relative time's units. Should match
   * the trigger it is shown for, so both read the same.
   */
  unitStyle?: UnitStyle;
}

/**
 * A detail card for a single timestamp, showing the relative time alongside
 * the absolute time in both the viewer's timezone and UTC.
 *
 * This is tooltip content rather than a standalone element — pass it as a
 * tooltip's title/body along with RELATIVE_TIME_TOOLTIP_PROPS. It styles only
 * itself, so adopting it cannot change how any other tooltip renders:
 *
 * ```tsx
 * <TimeSince
 *   date={date}
 *   {...RELATIVE_TIME_TOOLTIP_PROPS}
 *   tooltipBody={<RelativeTime date={date} label={t('Last Seen')} />}
 * />
 * ```
 */
export function RelativeTime({
  date,
  label,
  // Defaulted to match <TimeSince>, so a card that omits them reads the same
  // as the trigger that also omitted them.
  prefix = t('in'),
  suffix = t('ago'),
  unitStyle,
}: RelativeTimeProps) {
  const timezone = useTimezone();

  const abbreviation = moment.tz(date, timezone).format('z');
  // Zones that resolve to UTC itself would render the second row identically to
  // the first. Zones that merely share its offset right now (GMT, and BST's
  // winter half) keep both rows, because the differing label is the useful part.
  const isViewerUtc = abbreviation === UTC;

  return (
    <Card>
      <Flex align="center" justify="between" gap="xs" padding="md lg">
        <Text bold tabular>
          {label}
        </Text>
        <Text bold tabular wrap="nowrap">
          {getRelativeDate(date, suffix, prefix, unitStyle)}
        </Text>
      </Flex>
      <Separator orientation="horizontal" border="secondary" />
      <Grid
        columns="max-content 1fr max-content"
        rows={isViewerUtc ? '24px' : '24px 24px'}
        gap="0 sm"
        align="center"
        padding="md lg"
      >
        {!isViewerUtc && (
          <TimestampRow date={date} abbreviation={abbreviation} variant="info" />
        )}
        <TimestampRow date={date} abbreviation={UTC} variant="muted" utc />
      </Grid>
    </Card>
  );
}

/**
 * The card fills the tooltip edge to edge, but the padding and centered text it
 * has to defeat belong to the overlay, not to the card.
 *
 * Restyling the overlay would mean `overlayStyle`, which <Overlay> currently
 * drops on the floor — reinstating it would silently reactivate ~15 dormant
 * overrides across Replays, Dashboards, Dynamic Sampling and Releases. That is
 * worth fixing, but not from here, so the card cancels the padding locally
 * instead. Collapse this into `overlayStyle` once that passthrough is restored.
 */
const Card = styled('div')`
  min-width: ${WIDTH}px;
  text-align: left;
  margin: -${p => p.theme.space.md} -${p => p.theme.space.lg};
`;

/**
 * Timezone abbreviations are not prose, so they are not translated.
 */
const UTC = 'UTC';

/**
 * One row of the grid: the timezone pill, then the date and time in it. Renders
 * three grid children rather than a wrapper, so the columns stay aligned across
 * rows when one abbreviation is wider than the other.
 */
function TimestampRow({
  date,
  abbreviation,
  variant,
  utc,
}: {
  abbreviation: string;
  date: RelativeTimeProps['date'];
  variant: React.ComponentProps<typeof Tag>['variant'];
  utc?: boolean;
}) {
  return (
    <Fragment>
      <TimezoneTag variant={variant}>{abbreviation}</TimezoneTag>
      <Text tabular wrap="nowrap">
        <DateTime date={date} dateOnly year utc={utc} timeZone={false} />
      </Text>
      <Text align="right" tabular wrap="nowrap">
        <DateTime date={date} timeOnly utc={utc} timeZone={false} />
      </Text>
    </Fragment>
  );
}

/**
 * The design's timezone pill is smaller than the default `Tag` — 4px of
 * horizontal padding rather than 8px, which is what keeps the three columns
 * inside 240px. Only the geometry is overridden; the colors still come from
 * the `variant` tokens.
 */
const TimezoneTag = styled(Tag)`
  height: 17px;
  min-width: 20px;
  padding: 0 ${p => p.theme.space.xs};
  border-radius: ${p => p.theme.radius['2xs']};
`;
