import {Tag, type TagProps} from '@sentry/scraps/badge';

import {t} from 'sentry/locale';
import {humanize} from 'sentry/utils/string/humanize';
import type {
  InvestigationHypothesis,
  InvestigationHypothesisStatus,
  InvestigationOrchestrationWorkStatus,
  InvestigationVerificationStep,
} from 'sentry/views/investigations/types';

// Statuses are an open set — Seer can introduce one before Sentry knows the
// name — so every lookup below falls back to `humanize` rather than dropping
// the value.

function hasRun(step: InvestigationVerificationStep): boolean {
  return Boolean(step.result) || Boolean(step.error);
}

type HypothesisStatusDisplay = {label: string; variant: TagProps['variant']};

/**
 * The label and colour of the tag beside the hypothesis number.
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
    return {label: t('Accepted by you'), variant: 'success'};
  }
  if (hypothesis.decisionSource === 'user' && status === 'rejected') {
    return {label: t('Rejected by you'), variant: 'muted'};
  }

  switch (status) {
    case 'supported':
      return {label: t('Supported'), variant: 'success'};
    case 'accepted':
      return {label: t('Accepted'), variant: 'success'};
    case 'refuted':
      return {label: t('Refuted'), variant: 'muted'};
    case 'rejected':
      return {label: t('Rejected'), variant: 'muted'};
    // Checked, but the evidence did not settle it either way.
    case 'inconclusive':
      return {label: t('Inconclusive'), variant: 'warning'};
    case 'failed':
      return {label: t('Failed'), variant: 'danger'};
    case 'cancelled':
      return {label: t('Cancelled'), variant: 'muted'};
    case 'pending':
    case 'investigating':
      break;
    default:
      return {label: humanize(status), variant: 'muted'};
  }

  const steps = hypothesis.verificationSteps ?? [];
  if (steps.length === 0) {
    // Proposed, with nothing planned to test it yet.
    return {label: t('Formed'), variant: 'muted'};
  }
  if (steps.every(hasRun)) {
    // Every check has produced something; the verdict is what is missing.
    return {label: t('Evidence checked'), variant: 'muted'};
  }
  if (hypothesis.status === 'running') {
    return {label: t('Verifying…'), variant: 'info'};
  }
  return {label: t('Preparing checks'), variant: 'muted'};
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
 *   edge covers them and the tag carries the distinction.
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

type HypothesisStatusProps = {hypothesis: InvestigationHypothesis};

export function HypothesisStatus({hypothesis}: HypothesisStatusProps) {
  const {label, variant} = getHypothesisStatusDisplay(hypothesis);

  return (
    <Tag variant={variant} data-test-id="hypothesis-status">
      {label}
    </Tag>
  );
}
