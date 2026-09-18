import {useEffect, useState} from 'react';

import {Text} from '@sentry/scraps/text';

import {Duration} from 'sentry/components/duration';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {SECOND} from 'sentry/utils/formatters';

/**
 * How often a live elapsed time re-reads the clock.
 *
 * Matches the chat `ThinkingBlock`, whose trailing duration is the same
 * tenth-of-a-second counter: Seer's work is timed the same way wherever it is
 * shown, and at one decimal place a slower tick would visibly stutter.
 */
const ELAPSED_TIME_TICK_INTERVAL_MS = 100;

/**
 * Milliseconds between two ISO timestamps, or `null` when there is nothing to
 * measure — either endpoint missing, unparseable, or the pair running backwards.
 * A duration is only worth showing when it is real.
 */
export function getElapsedMilliseconds(start: string | null, end: string | null) {
  if (!start || !end) {
    return null;
  }
  const duration = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(duration) || duration < 0) {
    return null;
  }
  return duration;
}

/**
 * Elapsed milliseconds between `start` and `end`, counting up from `start`
 * while `end` is missing and `active` — work still in flight has no end yet, so
 * "now" stands in for one until it does.
 */
export function useElapsedTime(
  start: string | null,
  end: string | null,
  active: boolean
) {
  const now = useNow(active);
  return getElapsedMilliseconds(start, end ?? (active ? now : null));
}

/**
 * The current time as an ISO string, re-read while `active`. Exported for the
 * few callers that time several rows against one shared clock.
 */
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    if (!active) {
      return;
    }
    const interval = window.setInterval(
      () => setNow(new Date().toISOString()),
      ELAPSED_TIME_TICK_INTERVAL_MS
    );
    return () => window.clearInterval(interval);
  }, [active]);
  return now;
}

/**
 * A duration in the shape Seer's own transcript uses, e.g. `8.4s`.
 */
export function ElapsedDuration({milliseconds}: {milliseconds: number}) {
  return (
    <Text monospace variant="muted">
      <Duration seconds={milliseconds / 1000} fixedDigits={1} abbreviation />
    </Text>
  );
}

/**
 * The same duration pinned to seconds, however long the run gets.
 *
 * This is the `ThinkingBlock` formatting — one decimal place, `SECOND` as the
 * floor — so a run that has been going for a moment reads `0.4s` rather than
 * `400ms`. A counter that changes units under the reader is hard to follow.
 */
export function formatElapsedSeconds(milliseconds: number) {
  return getDuration(milliseconds / 1000, 1, true, false, false, SECOND);
}
