import {Flex} from '@sentry/scraps/layout';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {
  InvestigationHypothesis,
  InvestigationHypothesisStatus,
  InvestigationOrchestrationWorkStatus,
  InvestigationVerificationStep,
} from 'sentry/views/investigations/types';

type StatusVariant = 'success' | 'warning' | 'danger' | 'accent' | 'muted';

/**
 * Statuses where the agent has reached a verdict. Confidence is only meaningful
 * once it has, so a hypothesis still in flight shows a bare label.
 */
const SETTLED_STATUSES = new Set<string>([
  'supported',
  'refuted',
  'inconclusive',
  'accepted',
  'rejected',
]);

function isHypothesisSettled(status: InvestigationHypothesisStatus): boolean {
  return SETTLED_STATUSES.has(status);
}

/**
 * Turn an unrecognized wire value into something readable rather than dropping
 * it. Statuses are an open set — Seer can introduce one before Sentry knows the
 * name — so every lookup here needs a fallback.
 */
function humanize(status: string): string {
  return status.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase());
}

function hasRun(step: InvestigationVerificationStep): boolean {
  return Boolean(step.result) || Boolean(step.error);
}

type HypothesisStatusDisplay = {
  /** Whether the agent is actively working, which is what keeps the dot moving. */
  inFlight: boolean;
  label: string;
  variant: StatusVariant;
};

/**
 * What the status line says, and in what colour.
 *
 * A hypothesis in flight is all one `effectiveStatus`, but it passes through
 * several states worth naming: formed, having its checks planned, running them,
 * and done checking but not yet judged. Those are read off the verification
 * steps, since that is the only place the distinction exists. Only the running
 * state is coloured — the rest are staging posts, not outcomes.
 */
function getHypothesisStatusDisplay(
  hypothesis: InvestigationHypothesis
): HypothesisStatusDisplay {
  const status = hypothesis.effectiveStatus;

  // A decision the viewer made themselves reads differently from one the agent
  // reached, even though both land in `effectiveStatus`.
  if (hypothesis.decisionSource === 'user' && status === 'accepted') {
    return {label: t('Accepted by you'), variant: 'success', inFlight: false};
  }
  if (hypothesis.decisionSource === 'user' && status === 'rejected') {
    return {label: t('Rejected by you'), variant: 'muted', inFlight: false};
  }

  switch (status) {
    case 'supported':
      return {label: t('Supported'), variant: 'success', inFlight: false};
    case 'accepted':
      return {label: t('Accepted'), variant: 'success', inFlight: false};
    // Ruled out by the evidence. Not an error — a hypothesis the agent tested
    // and closed — but still a result worth registering as you scan the row,
    // which is why it is warning rather than muted.
    case 'refuted':
      return {label: t('Refuted'), variant: 'warning', inFlight: false};
    case 'rejected':
      return {label: t('Rejected'), variant: 'muted', inFlight: false};
    // Checked, but the evidence did not settle it either way.
    case 'inconclusive':
      return {label: t('Inconclusive'), variant: 'warning', inFlight: false};
    case 'failed':
      return {label: t('Failed'), variant: 'danger', inFlight: false};
    case 'cancelled':
      return {label: t('Cancelled'), variant: 'muted', inFlight: false};
    case 'pending':
    case 'investigating':
      break;
    default:
      return {label: humanize(status), variant: 'muted', inFlight: false};
  }

  const steps = hypothesis.verificationSteps;
  if (steps.length === 0) {
    // Proposed, with nothing planned to test it yet.
    return {label: t('Formed'), variant: 'muted', inFlight: false};
  }
  if (steps.every(hasRun)) {
    // Every check has produced something; the verdict is what is missing.
    return {label: t('Evidence checked'), variant: 'muted', inFlight: false};
  }
  if (hypothesis.status === 'running') {
    return {label: t('Verifying…'), variant: 'accent', inFlight: true};
  }
  return {label: t('Preparing checks'), variant: 'muted', inFlight: false};
}

/**
 * How a card's edge should be drawn for a given verdict.
 *
 * - `accent` — the explanation that stands: supported by the evidence, or
 *   endorsed by a person. A solid purple edge means "this is the answer".
 * - `solid` — still being investigated. Nothing has been ruled out yet, so the
 *   card gets an ordinary edge; dashing it would announce a verdict the agent
 *   has not reached.
 * - `dashed` — checked, and not the answer. Ruled out, inconclusive, failed and
 *   cancelled all read the same way to someone scanning the row, so one broken
 *   edge covers them and the status line carries the distinction.
 */
export function getHypothesisCardBorder(
  status: InvestigationHypothesisStatus
): 'accent' | 'solid' | 'dashed' {
  if (status === 'supported' || status === 'accepted') {
    return 'accent';
  }
  return status === 'pending' || status === 'investigating' ? 'solid' : 'dashed';
}

/** The heading above the steps, which depends on whether any have run yet. */
export function getEvidenceSectionLabel(steps: InvestigationVerificationStep[]): string {
  return steps.some(hasRun) ? t('Evidence checked') : t('Evidence to check');
}

/**
 * What a verification step says about itself while it has no result yet. A step
 * only carries a `result` once it has finished, so everything short of that
 * needs a stand-in line rather than an empty row.
 */
export function getVerificationStepStatusLabel(
  status: InvestigationOrchestrationWorkStatus
): string {
  switch (status) {
    // Queued and running read the same from outside: the answer is not here
    // yet. Only the states that need someone to act get their own line.
    case 'not_started':
    case 'queued':
    case 'running':
      return t('Awaiting evidence');
    case 'blocked':
      return t('Blocked on an earlier step.');
    case 'reauth_required':
      return t('Waiting on reauthentication.');
    case 'stalled':
      return t('Stalled.');
    case 'cancelled':
      return t('Cancelled before it finished.');
    case 'failed':
      return t('This check failed.');
    case 'completed':
      // A completed step with no result is a gap in the projection, not a state
      // worth naming in the UI.
      return t('No result was recorded.');
    default:
      return humanize(status);
  }
}

/**
 * The confidence the card should show, as a whole percentage, or null when
 * there is nothing meaningful to show yet.
 *
 * The projection carries confidence in two places: denormalized onto the
 * hypothesis, and on the agent's verdict. The hypothesis-level value is the one
 * kept in step with `effectiveStatus`, so it wins; the verdict is the fallback
 * for a projection that has only filled the latter in.
 */
function getHypothesisConfidencePercent(
  hypothesis: InvestigationHypothesis
): number | null {
  if (!isHypothesisSettled(hypothesis.effectiveStatus)) {
    return null;
  }
  const confidence = hypothesis.confidence ?? hypothesis.agentVerdict?.confidence;
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
    return null;
  }
  return Math.round(confidence * 100);
}

type HypothesisStatusProps = {
  hypothesis: InvestigationHypothesis;
};

/**
 * The dot-and-label line above a hypothesis statement, e.g.
 * "● Supported · 86% confidence".
 */
export function HypothesisStatus({hypothesis}: HypothesisStatusProps) {
  const {inFlight, label, variant} = getHypothesisStatusDisplay(hypothesis);
  const confidence = getHypothesisConfidencePercent(hypothesis);

  return (
    // "Evidence checked" is both a status and the heading over the steps, so
    // this needs to be addressable on its own.
    <Flex align="center" gap="xs" data-test-id="hypothesis-status">
      {inFlight ? (
        // Live work gets a ring rather than a dot: the agent is doing
        // something, not resting in a state. Every other status is a place the
        // hypothesis has come to a stop, however briefly.
        <Flex width="12px" height="12px" align="center" justify="center">
          <LoadingIndicator size={12} />
        </Flex>
      ) : (
        <StatusIndicator variant={variant} animationIterationCount={1} />
      )}
      <Text size="sm" variant={variant} bold>
        {confidence === null
          ? label
          : // Translators: e.g. "Supported · 86% Confidence"
            t('%s · %s%% Confidence', label, confidence)}
      </Text>
    </Flex>
  );
}
