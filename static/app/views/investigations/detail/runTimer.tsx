import {useEffect, useState} from 'react';

import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {formatSecondsToClock} from 'sentry/utils/duration/formatSecondsToClock';

/**
 * Wall time since `startedAt`, re-read once a second.
 *
 * A second is as fine as this needs to be: the counter sits beside the status
 * badge as a sign of life, not a measurement, and anything faster only spends
 * renders. `null` when the timestamp is unusable or in the future — a counter
 * running backwards is worse than no counter.
 */
function useElapsedSeconds(startedAt: string): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) {
    return null;
  }
  const elapsed = Math.floor((now - start) / 1000);
  return elapsed < 0 ? null : elapsed;
}

type InvestigationRunTimerProps = {
  /** When the investigation started, as an ISO timestamp. */
  startedAt: string;
};

/**
 * How long the investigation has been going, counting up.
 *
 * Only worth rendering while the run is still moving — a finished run's badge
 * says how it ended, and a clock next to it would keep ticking past the work.
 */
export function InvestigationRunTimer({startedAt}: InvestigationRunTimerProps) {
  const elapsedSeconds = useElapsedSeconds(startedAt);

  if (elapsedSeconds === null) {
    return null;
  }

  return (
    <Text
      size="sm"
      variant="muted"
      monospace
      tabular
      wrap="nowrap"
      role="timer"
      aria-label={t('Time elapsed')}
    >
      {formatSecondsToClock(elapsedSeconds, {padAll: false})}
    </Text>
  );
}
