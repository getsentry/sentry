import {Flex} from '@sentry/scraps/layout';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {humanize} from 'sentry/utils/string/humanize';
import type {
  InvestigationHypothesis,
  InvestigationHypothesisStatus,
  InvestigationVerificationStep,
} from 'sentry/views/investigations/types';

// Statuses are an open set — Seer can introduce one before Sentry knows the
// name — so every lookup below falls back to `humanize` rather than dropping
// the value.

function hasRun(step: InvestigationVerificationStep): boolean {
  return Boolean(step.result) || Boolean(step.error);
}

type HypothesisStatusVariant = 'accent' | 'success' | 'warning' | 'danger' | 'muted';

type HypothesisStatusDisplay = {
  label: string;
  variant: HypothesisStatusVariant;
};

/**
 * The label and colour of the status beside the hypothesis number.
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
    return {label: t('Verifying…'), variant: 'accent'};
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
 *   edge covers them and the status carries the distinction.
 */
export function getHypothesisCardBorder(
  status: InvestigationHypothesisStatus
): 'accent' | 'solid' | 'dashed' {
  if (status === 'supported' || status === 'accepted') {
    return 'accent';
  }
  return status === 'pending' || status === 'investigating' ? 'solid' : 'dashed';
}

type HypothesisStatusProps = {
  hypothesis: InvestigationHypothesis;
};

export function HypothesisStatus({hypothesis}: HypothesisStatusProps) {
  const {label, variant} = getHypothesisStatusDisplay(hypothesis);

  return (
    <Flex align="center" gap="sm" data-test-id="hypothesis-status">
      {/* Only live work pulses; a settled status is a still dot. */}
      <StatusIndicator
        variant={variant}
        animationIterationCount={variant === 'accent' ? 'infinite' : 0}
      />
      <Text size="sm" variant={variant}>
        {label}
      </Text>
    </Flex>
  );
}
