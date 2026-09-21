import {useEffect, useState} from 'react';

import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {formatInvestigationDuration} from 'sentry/utils/duration/formatInvestigationDuration';
import type {InvestigationOrchestration} from 'sentry/views/investigations/types';

export function InvestigationRunTimer({
  orchestration,
}: {
  orchestration: InvestigationOrchestration;
}) {
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

  return (
    <LiveDuration
      key={`${orchestration.runId}:${orchestration.generation}:${serverTime}:${seconds}:${active}`}
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
      variant="disabled"
      tabular
      monospace
      bold={false}
      density="fixed"
      wrap="nowrap"
      role="timer"
      aria-label={t('Investigation active time')}
    >
      {formatInvestigationDuration(seconds + localSeconds)}
    </Text>
  );
}
