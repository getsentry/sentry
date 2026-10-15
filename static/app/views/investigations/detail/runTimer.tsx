import {useEffect, useState} from 'react';

import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {formatElapsedDuration} from 'sentry/utils/duration/formatElapsedDuration';
import type {InvestigationOrchestration} from 'sentry/views/investigations/types';

/**
 * How long the run has been working, in seconds, as of the projection's
 * snapshot, and whether that clock is still running. `null` when the
 * projection can't vouch for a value.
 *
 * The seconds are measured on the server's clock, so a caller that keeps
 * counting should add only time it measured itself since the snapshot landed,
 * never the gap between `serverTime` and its own wall clock.
 */
export function getInvestigationActiveTime(
  orchestration: InvestigationOrchestration
): {active: boolean; seconds: number} | null {
  const {
    startedAt,
    finishedAt,
    activeTimeElapsedSeconds,
    activeSince,
    serverTime,
    status,
  } = orchestration;
  const terminal = ['completed', 'failed', 'cancelled'].includes(status);
  const active = status === 'processing' || status === 'pending';
  if (
    !startedAt ||
    !Number.isFinite(Date.parse(startedAt)) ||
    activeTimeElapsedSeconds === null ||
    activeTimeElapsedSeconds === undefined ||
    !Number.isFinite(activeTimeElapsedSeconds) ||
    activeTimeElapsedSeconds < 0 ||
    (terminal && (!finishedAt || !Number.isFinite(Date.parse(finishedAt)))) ||
    (active && finishedAt) ||
    (!active && !terminal && status !== 'awaiting_input')
  ) {
    return null;
  }

  let seconds = activeTimeElapsedSeconds;
  if (active) {
    if (!activeSince || !serverTime) {
      return null;
    }
    const interval = (Date.parse(serverTime) - Date.parse(activeSince)) / 1000;
    if (!Number.isFinite(interval) || interval < 0) {
      return null;
    }
    seconds += interval;
  } else if (activeSince !== null) {
    // A partial or stale projection cannot authoritatively freeze an active interval.
    return null;
  }

  return {active, seconds};
}

export function InvestigationRunTimer({
  orchestration,
}: {
  orchestration: InvestigationOrchestration;
}) {
  const activeTime = getInvestigationActiveTime(orchestration);
  if (!activeTime) {
    return null;
  }
  const {active, seconds} = activeTime;

  return (
    <LiveDuration
      key={`${orchestration.runId}:${orchestration.generation}:${orchestration.serverTime}:${seconds}:${active}`}
      seconds={seconds}
      active={active}
    />
  );
}

function LiveDuration({seconds, active}: {active: boolean; seconds: number}) {
  const [localSeconds, setLocalSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      return;
    }
    // Measure only time since this authoritative snapshot; never use the client's wall clock.
    const receivedAt = performance.now();
    const timer = window.setInterval(
      () => setLocalSeconds((performance.now() - receivedAt) / 1000),
      100
    );
    return () => window.clearInterval(timer);
  }, [active]);

  return (
    <Text
      size="sm"
      variant="muted"
      tabular
      monospace
      bold={false}
      density="fixed"
      wrap="nowrap"
      role="timer"
      aria-label={t('Investigation active time')}
    >
      {formatElapsedDuration((seconds + localSeconds) * 1000)}
    </Text>
  );
}
