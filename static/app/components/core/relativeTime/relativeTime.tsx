import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {getRelativeDate, type UnitStyle} from 'sentry/components/timeSince';
import {useTimezone} from 'sentry/components/timezoneProvider';
import {t} from 'sentry/locale';

/**
 * The card is designed at a fixed 240px, border included.
 */
const WIDTH = 240;

/**
 * Tooltip props required to render <RelativeTime> at its designed size. The
 * card owns its own padding so the surrounding overlay must not add any, and
 * the default centered alignment does not apply to the tabular rows.
 *
 * `width` and `maxWidth` must agree — the overlay's default `max-width` of
 * 225px would otherwise clamp the card and force its rows to overflow.
 */
export const RELATIVE_TIME_TOOLTIP_PROPS = {
  maxWidth: WIDTH,
  overlayStyle: {padding: 0, textAlign: 'left', width: WIDTH},
} satisfies {maxWidth: number; overlayStyle: React.CSSProperties};

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
   * Show the accent marker beside the label. Off by default — it is reserved
   * for surfaces where the dot carries meaning, not decoration.
   */
  showMarker?: boolean;
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
 * tooltip's title/body along with RELATIVE_TIME_TOOLTIP_PROPS:
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
  showMarker = false,
}: RelativeTimeProps) {
  const timezone = useTimezone();

  return (
    <Container width="100%">
      <Flex align="center" justify="between" gap="xs" padding="md lg">
        <Flex align="center" gap="xs">
          {showMarker && <Marker aria-hidden />}
          <Text bold tabular>
            {label}
          </Text>
        </Flex>
        <Text bold tabular wrap="nowrap">
          {getRelativeDate(date, suffix, prefix, unitStyle)}
        </Text>
      </Flex>
      <Separator orientation="horizontal" border="secondary" />
      <Grid
        columns="max-content 1fr max-content"
        rows="24px 24px"
        gap="0 sm"
        align="center"
        padding="md lg"
      >
        <TimezoneTag variant="info">{moment.tz(date, timezone).format('z')}</TimezoneTag>
        <Text tabular wrap="nowrap">
          <DateTime date={date} dateOnly year timeZone={false} />
        </Text>
        <Text align="right" tabular wrap="nowrap">
          <DateTime date={date} timeOnly timeZone={false} />
        </Text>

        {/* Timezone abbreviations are not prose, so they are not translated */}
        <TimezoneTag variant="muted">UTC</TimezoneTag>
        <Text tabular wrap="nowrap">
          <DateTime date={date} dateOnly year utc timeZone={false} />
        </Text>
        <Text align="right" tabular wrap="nowrap">
          <DateTime date={date} timeOnly utc timeZone={false} />
        </Text>
      </Grid>
    </Container>
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

const Marker = styled('span')`
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: ${p => p.theme.radius.full};
  background: ${p => p.theme.tokens.graphics.accent.vibrant};
`;
