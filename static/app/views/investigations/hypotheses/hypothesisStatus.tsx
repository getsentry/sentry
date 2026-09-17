import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {humanize} from 'sentry/utils/string/humanize';
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

// Statuses are an open set — Seer can introduce one before Sentry knows the
// name — so every lookup below falls back to `humanize` rather than dropping
// the value.

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

  const steps = hypothesis.verificationSteps ?? [];
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
    // The dot and its label are one statement, so they are one color.
    //
    // Left to themselves they disagree: `StatusIndicator` fills from the
    // `background.*.vibrant` ramp while `Text` paints from `content.*`, which
    // is darker in every variant — several steps for `muted`. Side by side the
    // dot read as a lighter mark unrelated to the label it belongs to.
    //
    // `Text` already owns that variant-to-token mapping, `muted` ->
    // `content.secondary` included, so its render-prop form hands the styling
    // to the row itself rather than to a span inside it. The dot then picks the
    // color up as `currentColor`, and there is no second copy of the table here
    // to fall out of step with the design system.
    <Text size="sm" variant={variant} bold>
      {textProps => (
        // Spread rather than picking `className` off: `Text` decides what its
        // render function hands down, and naming one prop drops the rest.
        //
        // "Evidence checked" is both a status and the heading over the steps,
        // so this needs to be addressable on its own.
        <Flex {...textProps} align="center" gap="xs" data-test-id="hypothesis-status">
          {inFlight ? (
            // Live work gets a ring rather than a dot: the agent is doing
            // something, not resting in a state. Every other status is a place
            // the hypothesis has come to a stop, however briefly.
            <Flex width="12px" height="12px" align="center" justify="center">
              <LoadingIndicator size={12} />
            </Flex>
          ) : (
            <StatusDot>
              <StatusIndicator variant={variant} animationIterationCount={1} />
            </StatusDot>
          )}
          {confidence === null
            ? label
            : // Translators: e.g. "Supported · 86% Confidence"
              t('%s · %s%% Confidence', label, confidence)}
        </Flex>
      )}
    </Text>
  );
}

/**
 * Pins the dot to the line's color.
 *
 * `StatusIndicator` exposes no color of its own — the variant is the whole API
 * — so this repaints the dot it draws in `::after`. The pulse behind it
 * (`::before`) is deliberately left on its translucent token: it is a halo, and
 * giving it the text color would make it a second, solid dot. `variant` is
 * still passed through, so if this override ever stops matching, the dot falls
 * back to its own ramp rather than disappearing.
 */
const StatusDot = styled('span')`
  display: inline-flex;

  & > span::after {
    background-color: currentColor;
  }
`;
