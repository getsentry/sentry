import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {formatElapsedSeconds, useElapsedTime} from 'sentry/utils/duration/useElapsedTime';

type InvestigationRunTimerProps = {
  /** When the investigation started, as an ISO timestamp. */
  startedAt: string;
  /**
   * When the run stopped, as an ISO timestamp. Absent while it is still going,
   * which is what makes the counter live.
   */
  endedAt?: string | null;
};

/**
 * How long the investigation has been going, or how long it took.
 *
 * The same counter Seer's own transcript runs — `useElapsedTime` behind the
 * seconds-pinned formatting — so the header reads in the same units as the
 * steps below it. A run in flight counts up; a run that has stopped freezes at
 * its total, which is the number worth keeping.
 *
 * The status chip next to it already says which of the two this is, so the
 * duration stands on its own. The distinction survives for screen readers in
 * the accessible name, where there is no chip to read it off.
 */
export function InvestigationRunTimer({startedAt, endedAt}: InvestigationRunTimerProps) {
  const isRunning = !endedAt;
  const elapsed = useElapsedTime(startedAt, endedAt, {active: isRunning});

  if (elapsed === null) {
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
      aria-label={isRunning ? t('Time elapsed') : t('Total run time')}
    >
      {formatElapsedSeconds(elapsed)}
    </Text>
  );
}
