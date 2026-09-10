import {Flex} from '@sentry/scraps/layout';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {
  InvestigationHypothesis,
  InvestigationHypothesisStatus,
  InvestigationOrchestrationWorkStatus,
} from 'sentry/views/investigations/types';

type StatusVariant = 'success' | 'warning' | 'danger' | 'accent' | 'muted';

/**
 * Statuses where the agent has reached a verdict. Confidence is only meaningful
 * once it has, so an in-flight hypothesis shows a bare label.
 */
const SETTLED_STATUSES = new Set<string>([
  'supported',
  'refuted',
  'inconclusive',
  'accepted',
  'rejected',
]);

/** Statuses where the agent is still working, so the dot keeps pulsing. */
const IN_FLIGHT_STATUSES = new Set<string>(['pending', 'investigating']);

function isHypothesisSettled(status: InvestigationHypothesisStatus): boolean {
  return SETTLED_STATUSES.has(status);
}

function isHypothesisInFlight(status: InvestigationHypothesisStatus): boolean {
  return IN_FLIGHT_STATUSES.has(status);
}

/**
 * Turn an unrecognized wire value into something readable rather than dropping
 * it. Statuses are an open set — Seer can introduce one before Sentry knows the
 * name — so every lookup here needs a fallback.
 */
function humanize(status: string): string {
  return status.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase());
}

function getHypothesisStatusLabel(hypothesis: InvestigationHypothesis): string {
  // A decision the viewer made themselves reads differently from one the agent
  // reached, even though both land in `effectiveStatus`.
  if (hypothesis.decisionSource === 'user') {
    if (hypothesis.effectiveStatus === 'accepted') {
      return t('Accepted by you');
    }
    if (hypothesis.effectiveStatus === 'rejected') {
      return t('Rejected by you');
    }
  }

  switch (hypothesis.effectiveStatus) {
    case 'pending':
      return t('Pending');
    case 'investigating':
      return t('Investigating');
    case 'supported':
      return t('Supported');
    case 'refuted':
      return t('Refuted');
    case 'inconclusive':
      return t('Inconclusive');
    case 'accepted':
      return t('Accepted');
    case 'rejected':
      return t('Rejected');
    case 'failed':
      return t('Failed');
    case 'cancelled':
      return t('Cancelled');
    default:
      return humanize(hypothesis.effectiveStatus);
  }
}

function getHypothesisStatusVariant(
  status: InvestigationHypothesisStatus
): StatusVariant {
  switch (status) {
    // A hypothesis the evidence backs, or one a person has endorsed.
    case 'supported':
    case 'accepted':
      return 'success';
    // Ruled out cleanly. This is a useful outcome rather than an error, so it
    // reads as neutral instead of dangerous.
    case 'refuted':
    case 'rejected':
      return 'muted';
    // Checked, but the evidence did not settle it either way.
    case 'inconclusive':
      return 'warning';
    case 'investigating':
      return 'accent';
    case 'failed':
      return 'danger';
    case 'pending':
    case 'cancelled':
      return 'muted';
    default:
      return 'muted';
  }
}

/**
 * How a card's edge should be drawn for a given verdict.
 *
 * - `accent` — the explanation that stands: supported by the evidence, or
 *   endorsed by a person. A solid purple edge means "this is the answer".
 * - `dashed` — everything else. A hypothesis still being investigated, ruled
 *   out, inconclusive, or failed is all the same thing to a reader scanning the
 *   row: not the answer. One broken edge says that without needing a colour per
 *   status, which the status line already carries.
 */
export function getHypothesisCardBorder(
  status: InvestigationHypothesisStatus
): 'accent' | 'dashed' {
  return status === 'supported' || status === 'accepted' ? 'accent' : 'dashed';
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
    case 'not_started':
    case 'queued':
      return t('Queued.');
    case 'running':
      return t('Checking…');
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
 * "● Supported · 86% Confidence".
 */
export function HypothesisStatus({hypothesis}: HypothesisStatusProps) {
  const status = hypothesis.effectiveStatus;
  const variant = getHypothesisStatusVariant(status);
  const label = getHypothesisStatusLabel(hypothesis);
  const confidence = getHypothesisConfidencePercent(hypothesis);

  return (
    <Flex align="center" gap="xs">
      <StatusIndicator
        variant={variant}
        // Settled hypotheses pulse once and rest; only live work keeps moving.
        animationIterationCount={isHypothesisInFlight(status) ? 'infinite' : 1}
      />
      <Text size="sm" variant={variant} bold>
        {confidence === null
          ? label
          : // Translators: e.g. "Supported · 86% Confidence"
            t('%s · %s%% Confidence', label, confidence)}
      </Text>
    </Flex>
  );
}
