import {useEffect, useState} from 'react';

import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {formatElapsedDuration} from 'sentry/utils/duration/formatElapsedDuration';
import {
  getInvestigationActiveTime,
  isOnlyNextStepPending,
} from 'sentry/views/investigations/runState';
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
  const activeTime = getInvestigationActiveTime(orchestration);
  const active = activeTime?.active ?? false;
  let seconds = activeTime?.seconds ?? null;

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
