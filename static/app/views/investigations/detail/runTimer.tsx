import {useEffect, useState} from 'react';

import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {formatElapsedDuration} from 'sentry/utils/duration/formatElapsedDuration';
import {isOnlyNextStepPending} from 'sentry/views/investigations/statusBlock/getSeerStatusBlock';
import type {InvestigationOrchestration} from 'sentry/views/investigations/types';

export function InvestigationRunTimer({
  orchestration,
}: {
  orchestration: InvestigationOrchestration;
}) {
  const [settledSeconds, setSettledSeconds] = useState<{
    runKey: string;
    seconds: number;
  } | null>(null);
  const runKey = `${orchestration.runId}:${orchestration.generation}`;
  const settled = isOnlyNextStepPending(orchestration);
  const active = !settled && ['processing', 'pending'].includes(orchestration.status);
  let seconds = getActiveSeconds(orchestration, settled, active);

  const frozenSeconds = settledSeconds?.runKey === runKey ? settledSeconds.seconds : null;
  if (settled && seconds !== null) {
    if (frozenSeconds === null) {
      setSettledSeconds({runKey, seconds});
    } else {
      seconds = frozenSeconds;
    }
  } else if (
    frozenSeconds !== null &&
    seconds !== null &&
    orchestration.status === 'completed'
  ) {
    seconds = frozenSeconds;
  } else if (settledSeconds !== null) {
    setSettledSeconds(null);
  }

  if (seconds === null) {
    return null;
  }

  return (
    <LiveDuration
      key={`${runKey}:${orchestration.serverTime}:${seconds}:${active}`}
      seconds={seconds}
      active={active}
    />
  );
}

function getActiveSeconds(
  orchestration: InvestigationOrchestration,
  settled: boolean,
  active: boolean
): number | null {
  const {
    startedAt,
    finishedAt,
    activeTimeElapsedSeconds,
    activeSince,
    serverTime,
    status,
  } = orchestration;
  const terminal = !settled && ['completed', 'failed', 'cancelled'].includes(status);
  if (
    !startedAt ||
    !Number.isFinite(Date.parse(startedAt)) ||
    activeTimeElapsedSeconds === null ||
    activeTimeElapsedSeconds === undefined ||
    !Number.isFinite(activeTimeElapsedSeconds) ||
    activeTimeElapsedSeconds < 0 ||
    (terminal && (!finishedAt || !Number.isFinite(Date.parse(finishedAt)))) ||
    (active && finishedAt) ||
    (!active && !terminal && !settled && status !== 'awaiting_input')
  ) {
    return null;
  }

  let seconds = activeTimeElapsedSeconds;
  if (active || (settled && activeSince !== null)) {
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
  return seconds;
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
