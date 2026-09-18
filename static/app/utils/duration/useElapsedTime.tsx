import {useEffect, useState} from 'react';

import {getDuration} from 'sentry/utils/duration/getDuration';
import {SECOND} from 'sentry/utils/formatters';

/**
 * How often a live elapsed time re-reads the clock. At one decimal place a
 * slower tick would visibly stutter.
 */
const ELAPSED_TIME_TICK_INTERVAL_MS = 100;

/** A point in time in any of the shapes the callers already hold. */
type TimeInput = Date | number | string;

function toMilliseconds(value: TimeInput | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const milliseconds =
    value instanceof Date
      ? value.getTime()
      : typeof value === 'number'
        ? value
        : Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

/**
 * Milliseconds between two points in time, or `null` when there is nothing to
 * measure — either endpoint missing, unparseable, or the pair running
 * backwards. A duration is only worth showing when it is real.
 */
export function getElapsedMilliseconds(
  start: TimeInput | null | undefined,
  end: TimeInput | null | undefined
): number | null {
  const startMs = toMilliseconds(start);
  const endMs = toMilliseconds(end);
  if (startMs === null || endMs === null) {
    return null;
  }
  const elapsed = endMs - startMs;
  return elapsed < 0 ? null : elapsed;
}

/**
 * Elapsed milliseconds between `start` and `end`, counting up while `end` is
 * missing — work still in flight has no end yet, so "now" stands in for one
 * until it does.
 *
 * Pass `active` when something other than a missing `end` decides whether the
 * clock should run: a caller timing several rows against one shared clock knows
 * the run has stopped before the last row has an end of its own.
 */
export function useElapsedTime(
  start: TimeInput | null | undefined,
  end: TimeInput | null | undefined,
  {active}: {active?: boolean} = {}
): number | null {
  const isActive = active ?? !end;
  const now = useNow(isActive);
  return getElapsedMilliseconds(start, end ?? (isActive ? now : null));
}

/**
 * The current time, re-read while `active`. Exported for the callers that time
 * several rows against one shared clock.
 */
export function useNow(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!active) {
      return;
    }
    const interval = window.setInterval(
      () => setNow(new Date()),
      ELAPSED_TIME_TICK_INTERVAL_MS
    );
    return () => window.clearInterval(interval);
  }, [active]);

  return now;
}

/**
 * An elapsed time pinned to seconds, however long the work runs: `0.4s`, not
 * `400ms`. A counter that changes units under the reader is hard to follow.
 *
 * Past a minute `getDuration` still rolls up (`1.5min`), which is what every
 * surface showing agent timings has always done.
 */
export function formatElapsedSeconds(milliseconds: number): string {
  return getDuration(milliseconds / 1000, 1, true, false, false, SECOND);
}
