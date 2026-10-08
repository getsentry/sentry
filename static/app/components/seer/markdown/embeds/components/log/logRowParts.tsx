import {useTheme} from '@emotion/react';

import {Tooltip} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import {ColoredLogCircle, getLogColors, LogDate} from 'sentry/views/explore/logs/styles';
import {
  getLogSeverityLevel,
  SeverityLevel,
  severityLevelToText,
} from 'sentry/views/explore/logs/utils';

function toText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/**
 * The severity dot that leads every row of the logs table: the level's color,
 * with the level's name on hover.
 */
export function LogSeverityDot({
  severity,
  severityNumber,
}: {
  severity: unknown;
  severityNumber: unknown;
}) {
  const theme = useTheme();
  const severityText = toText(severity) || 'unknown';
  const level = getLogSeverityLevel(
    severityNumber ? Number(severityNumber) : null,
    severityText
  );

  return (
    <Tooltip
      skipWrapper
      disabled={level === SeverityLevel.UNKNOWN}
      title={severityLevelToText(level)}
    >
      <ColoredLogCircle
        data-test-id="seer-log-severity"
        logColors={getLogColors(level, theme)}
      >
        {severityText}
      </ColoredLogCircle>
    </Tooltip>
  );
}

/**
 * `timestamp_precise` is in nanoseconds; drop the last six digits for millis,
 * the same truncation the logs table's timestamp renderer does.
 */
function preciseToMillis(precise: unknown): number | null {
  const text = toText(precise);
  if (!text) {
    return null;
  }
  const millis = Number(text.slice(0, -6));
  return Number.isFinite(millis) && millis > 0 ? millis : null;
}

/**
 * The logs table's timestamp: muted, to the millisecond, preferring the
 * nanosecond-precise value when the row carries one.
 */
export function LogTimestamp({
  timestamp,
  timestampPrecise,
}: {
  timestamp: unknown;
  timestampPrecise?: unknown;
}) {
  const date =
    preciseToMillis(timestampPrecise) ??
    (typeof timestamp === 'string' || typeof timestamp === 'number' ? timestamp : null);

  if (date === null || date === '') {
    return <LogDate>--</LogDate>;
  }

  return (
    <LogDate>
      <DateTime seconds milliseconds date={date} />
    </LogDate>
  );
}
