import type {InvestigationOrchestration} from 'sentry/views/investigations/types';

export function isWritingMetadata(projection: InvestigationOrchestration) {
  return projection.status === 'processing' && projection.phase === 'metadata';
}

export function isOnlyNextStepPending(projection: InvestigationOrchestration) {
  const {metadata, status} = projection.report;
  return (
    isWritingMetadata(projection) &&
    status === 'completed' &&
    (metadata.status === 'completed' || metadata.status === 'failed')
  );
}

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
  const settled = isOnlyNextStepPending(orchestration);
  const active = !settled && ['processing', 'pending'].includes(orchestration.status);
  const seconds = getActiveSeconds(orchestration, settled, active);
  return seconds === null ? null : {active, seconds};
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
