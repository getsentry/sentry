import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {
  formatElapsedSeconds,
  useElapsedTime,
} from 'sentry/views/investigations/detail/elapsedTime';

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
 * The same counter Seer's own transcript runs — `useElapsedTime` ticking at a
 * tenth of a second behind the `ThinkingBlock` formatting — so the header reads
 * in the same units as the steps below it. A run in flight counts up; a run
 * that has stopped freezes at its total, which is the number worth keeping.
 */
export function InvestigationRunTimer({startedAt, endedAt}: InvestigationRunTimerProps) {
  const isRunning = !endedAt;
  const elapsed = useElapsedTime(startedAt, endedAt ?? null, isRunning);

  if (elapsed === null) {
    return null;
  }

  return (
    <Flex align="center" gap="xs" wrap="nowrap" data-test-id="investigation-run-timer">
      <Text size="sm" variant="muted">
        {isRunning ? t('Running for') : t('Total time')}
      </Text>
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
    </Flex>
  );
}
