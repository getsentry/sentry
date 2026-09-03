import {getDuration} from 'sentry/utils/duration/getDuration';

const HOUR_MS = 60 * 60 * 1000;

function pad(value: number, length = 2): string {
  return String(Math.floor(value)).padStart(length, '0');
}

/**
 * An item's position in the session, as an offset from its start.
 *
 * Relative time is the unit that matters here: every absolute timestamp in a
 * session repeats the same date and the same hour, so the digits that actually
 * differ are the last few. Two decimals keep adjacent items distinguishable
 * without turning the gutter into a wall of numbers; the exact wall-clock time
 * stays one hover away.
 */
export function formatOffset(offsetMs: number): string {
  const clamped = Math.max(0, offsetMs);
  const seconds = clamped / 1000;

  if (clamped >= HOUR_MS) {
    // Past an hour, sub-second precision costs more width than it earns.
    return `${Math.floor(seconds / 3600)}:${pad((seconds % 3600) / 60)}:${pad(seconds % 60)}`;
  }

  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
}

/**
 * A duration, rounded to whatever unit keeps it short: `340ms`, `1.18s`, `42.0s`,
 * `1.5m`.
 *
 * Precision drops as the unit grows, but never to zero digits: rounding 90s to
 * the nearest minute would print `2m`, and a third of the way off is not a
 * rounding, it is a wrong number.
 */
export function formatDurationMs(durationMs: number): string {
  const digits = durationMs < 1000 ? 0 : durationMs < 10000 ? 2 : 1;
  return getDuration(durationMs / 1000, digits, true, true);
}
