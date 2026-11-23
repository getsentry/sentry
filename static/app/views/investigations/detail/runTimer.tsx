import {useEffect, useState, type ReactNode} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {formatElapsedDuration} from '@sentry/scraps/duration';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {
  getInvestigationActiveTime,
  isOnlyNextStepPending,
} from 'sentry/views/investigations/runState';
import type {
  InvestigationOrchestration,
  WorkflowReport,
} from 'sentry/views/investigations/types';

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

const STATUS_TAG_VARIANT = {
  running: 'info',
  awaitingInput: 'warning',
  failed: 'danger',
  complete: 'success',
  cancelled: 'muted',
} as const;

export function InvestigationRunStatus({
  variant,
  label,
  children,
}: {
  children: ReactNode;
  label: string;
  variant: keyof typeof STATUS_TAG_VARIANT;
}) {
  return (
    <Flex align="center" gap="md" wrap="nowrap">
      <Tag variant={STATUS_TAG_VARIANT[variant]}>{label}</Tag>
      {children}
    </Flex>
  );
}

export function WorkflowRunStatus({report}: {report: WorkflowReport}) {
  const states = {
    pending: [t('Queued'), 'running'],
    running: [t('Running…'), 'running'],
    awaiting_input: [t('Awaiting input'), 'awaitingInput'],
    failed: [t('Failed'), 'failed'],
    cancelled: [t('Cancelled'), 'cancelled'],
    succeeded: [t('Completed'), 'complete'],
  } satisfies Record<
    NonNullable<WorkflowReport['status']>,
    [string, keyof typeof STATUS_TAG_VARIANT]
  >;
  const status = report.status ?? (report.active ? 'running' : null);
  if (!status) {
    return null;
  }
  const [label, variant] = states[status];
  return (
    <InvestigationRunStatus variant={variant} label={label}>
      {typeof report.elapsedSeconds === 'number' && (
        <LiveDuration
          key={`${report.runId}:${report.elapsedSeconds}:${report.active}`}
          seconds={report.elapsedSeconds}
          active={report.active}
          label={t('Investigation elapsed time')}
        />
      )}
    </InvestigationRunStatus>
  );
}

function LiveDuration({
  seconds,
  active,
  label = t('Investigation active time'),
}: {
  active: boolean;
  seconds: number;
  label?: string;
}) {
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
      aria-label={label}
    >
      {formatElapsedDuration((seconds + localSeconds) * 1000)}
    </Text>
  );
}
