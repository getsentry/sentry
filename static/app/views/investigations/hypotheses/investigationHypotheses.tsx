import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {uuid4} from '@sentry/core';
import {useQuery} from '@tanstack/react-query';

import {Disclosure} from '@sentry/scraps/disclosure';
import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tn} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  investigationOrchestrationQueryOptions,
  useInvestigationOrchestrationCommandMutation,
} from 'sentry/views/investigations/api';
import {
  HypothesisList,
  HypothesisListPlaceholder,
} from 'sentry/views/investigations/hypotheses/hypothesisList';
import {getSeerStatusBlock} from 'sentry/views/investigations/statusBlock/getSeerStatusBlock';
import {SeerStatusBlock} from 'sentry/views/investigations/statusBlock/seerStatusBlock';
import type {
  InvestigationHypothesis,
  InvestigationOrchestrationPhase,
  InvestigationOrchestrationStatus,
} from 'sentry/views/investigations/types';

/** How often to re-read the projection while a workflow is still moving. */
const POLL_INTERVAL_MS = 2000;

/**
 * How long to keep re-reading a settled run after a command was accepted.
 *
 * Sentry only queues a command: the response carries the *existing* projection
 * with nothing but `workflowVersion` bumped, and Seer rewrites the projection
 * when it actually applies the decision. On a run that has already finished
 * polling is off, so without this the card would keep the old disposition until
 * someone reloaded the page — and accepting or rejecting a hypothesis on a
 * finished run is the main reason to touch that menu at all.
 *
 * Bounded rather than open-ended: if Seer never applies the command, this stops
 * asking instead of polling a stopped run forever.
 */
const COMMAND_SETTLE_MS = 30_000;

/**
 * Phases past producing hypotheses, where an empty list means the run made
 * none. Anywhere else an empty list means "not yet", including a run that is
 * investigating but has not written its first hypothesis.
 */
const SETTLED_PHASES = new Set<string>([
  'reporting',
  'metadata',
  'completed',
  'failed',
  'cancelled',
]);

/** Statuses the agent will never move out of on its own. */
const TERMINAL_STATUSES = new Set<string>(['completed', 'failed', 'cancelled']);

/**
 * Whether the projection is still worth re-reading.
 *
 * `awaiting_input` is the subtle one. A run blocked on a person does not move
 * until someone supplies a prompt, and an investigation created without one
 * starts there and stays there, so polling it would be a permanent two-second
 * request loop on a run nobody is driving. Supplying input from this client
 * writes the new projection straight into the cache, which starts it again.
 *
 * But Sentry parks a brand-new run at `awaiting_input` *before* it has finished
 * creating it in Seer: the create is dispatched after the transaction commits,
 * and until it lands the run carries no Seer id. In that window the status is a
 * placeholder rather than a decision to wait for a person, and the create can
 * still fail the run or rewrite the projection underneath it — so it has to
 * keep being read. `hasSeerRun` is how a caller says which of the two it is.
 *
 * Callers that cannot tell leave it alone and get the blocked-on-a-person
 * reading: the detail view decides from the summary served alongside the
 * investigation, and that summary carries no run id.
 */
export function shouldPollInvestigationRun(
  status: InvestigationOrchestrationStatus | undefined,
  hasSeerRun = true
): boolean {
  if (status === undefined) {
    return true;
  }
  if (TERMINAL_STATUSES.has(status)) {
    return false;
  }
  return status === 'awaiting_input' ? !hasSeerRun : true;
}

type InvestigationHypothesesProps = {
  investigationId: string;
  /**
   * Set false for an investigation with no agentic run behind it — the
   * orchestration endpoint 404s for those, and there is nothing to poll.
   */
  enabled?: boolean;
  /**
   * The run's phase from the investigation summary. Only used before the
   * projection arrives, so a finished run opens collapsed instead of showing a
   * placeholder that collapses a moment later. Optional: the projection
   * replaces it as soon as it lands.
   */
  phase?: InvestigationOrchestrationPhase;
};

/**
 * The hypothesis row for an agentic investigation, wired to the live run.
 *
 * This is the whole agent-to-frontend path in one place. Seer overwrites the
 * projection on every orchestration event; Sentry stores it on
 * `InvestigationOrchestrationRun.projection` and serves the latest one here. So
 * the agent decides what these cards say purely by what it writes into
 * `projection.hypotheses` — there is no separate signal telling the frontend to
 * render a hypothesis, and no block kind to add.
 *
 * Actions travel back the other way as versioned commands, fenced on
 * `workflowVersion` so a decision made against a stale view is rejected rather
 * than applied to a run that has moved on.
 */
export function InvestigationHypotheses({
  enabled = true,
  investigationId,
  phase: summaryPhase,
}: InvestigationHypothesesProps) {
  const organization = useOrganization();
  // When the last accepted command was sent, or null if none has been. A
  // command makes a settled run interesting again, because Seer is about to
  // rewrite the projection behind it.
  const [commandSentAt, setCommandSentAt] = useState<number | null>(null);

  const {data: projection, isPending} = useQuery({
    ...investigationOrchestrationQueryOptions(organization.slug, investigationId),
    enabled,
    refetchInterval: query => {
      const run = query.state.data?.json;
      if (shouldPollInvestigationRun(run?.status, run?.runId !== null)) {
        return POLL_INTERVAL_MS;
      }
      const waitingOnCommand =
        commandSentAt !== null && Date.now() - commandSentAt < COMMAND_SETTLE_MS;
      return waitingOnCommand ? POLL_INTERVAL_MS : false;
    },
  });

  const commandMutation = useInvestigationOrchestrationCommandMutation(
    organization.slug,
    investigationId,
    {onSuccess: () => setCommandSentAt(Date.now())}
  );

  const phase = projection?.phase ?? summaryPhase;
  const verificationComplete =
    projection?.status === 'completed' ||
    ['reporting', 'metadata', 'completed'].includes(phase ?? '');
  // A run that has already finished verifying when the page loads opens
  // collapsed: the report is what the viewer came for. A run that finishes while
  // someone watches keeps the panel as it was, so the cards they were reading
  // don't fold away underneath them. The decision is made once, on the first
  // projection — until then the summary's phase stands in for it — and a
  // toggle by the viewer before that lands settles it too.
  const [panelState, setPanelState] = useState({
    investigationId,
    settled: projection !== undefined,
    expanded: !verificationComplete,
  });

  if (panelState.investigationId !== investigationId) {
    setPanelState({
      investigationId,
      settled: projection !== undefined,
      expanded: !verificationComplete,
    });
  } else if (
    !panelState.settled &&
    (projection !== undefined || panelState.expanded === verificationComplete)
  ) {
    setPanelState({
      investigationId,
      settled: projection !== undefined,
      expanded: !verificationComplete,
    });
  }

  function setExpanded(expanded: boolean) {
    setPanelState({investigationId, settled: true, expanded});
  }

  // Nothing is known yet, so the panel goes up empty rather than appearing a
  // moment later. A run with no hypotheses left to produce is skipped: its
  // panel would open on placeholders and then collapse.
  if (!projection) {
    const worthHoldingSpaceFor = enabled && isPending && !SETTLED_PHASES.has(phase ?? '');

    return worthHoldingSpaceFor ? (
      <Stack gap="2xl">
        <HypothesesPanel expanded={panelState.expanded} onExpandedChange={setExpanded}>
          <HypothesisListPlaceholder />
        </HypothesesPanel>
      </Stack>
    ) : null;
  }

  // A finished run has nothing left to report here: the findings below speak
  // for themselves, and the header badge still says it completed. Every other
  // state — running, waiting on input, failed, stopped — keeps the block.
  const seerStatus = getSeerStatusBlock(projection);
  const statusBlock = seerStatus?.variant === 'complete' ? null : seerStatus;
  const {workflowVersion} = projection;
  const commandPending = commandMutation.isPending;
  const completedChecks = projection.hypotheses.reduce(
    (count, hypothesis) =>
      count +
      (hypothesis.verificationSteps ?? []).filter(step => step.status === 'completed')
        .length,
    0
  );

  function setDisposition(
    hypothesis: InvestigationHypothesis,
    disposition: 'accepted' | 'rejected'
  ) {
    commandMutation.mutate({
      requestId: uuid4(),
      expectedWorkflowVersion: workflowVersion,
      command: {
        type: 'set_hypothesis_disposition',
        hypothesisId: hypothesis.id,
        // Choosing the decision the viewer already made clears it, so the same
        // menu entry toggles rather than needing a separate "undo".
        disposition:
          hypothesis.decisionSource === 'user' &&
          hypothesis.effectiveStatus === disposition
            ? null
            : disposition,
      },
    });
  }

  function getActions(hypothesis: InvestigationHypothesis): MenuItemProps[] {
    const decidedByUser = hypothesis.decisionSource === 'user';

    return [
      {
        key: 'accept',
        label:
          decidedByUser && hypothesis.effectiveStatus === 'accepted'
            ? t('Clear decision')
            : t('Accept'),
        disabled: commandPending,
        onAction: () => setDisposition(hypothesis, 'accepted'),
      },
      {
        key: 'reject',
        label:
          decidedByUser && hypothesis.effectiveStatus === 'rejected'
            ? t('Clear decision')
            : t('Reject'),
        disabled: commandPending,
        onAction: () => setDisposition(hypothesis, 'rejected'),
      },
      {
        key: 'retry',
        label: t('Investigate again'),
        disabled: commandPending || hypothesis.effectiveStatus === 'investigating',
        onAction: () =>
          commandMutation.mutate({
            requestId: uuid4(),
            expectedWorkflowVersion: workflowVersion,
            command: {type: 'retry', target: 'hypothesis', targetId: hypothesis.id},
          }),
      },
    ];
  }

  const hasHypotheses = projection.hypotheses.length > 0;
  const awaitingFirstHypothesis = !hasHypotheses && !SETTLED_PHASES.has(projection.phase);

  return (
    <Stack gap="2xl">
      {statusBlock ? <SeerStatusBlock {...statusBlock} /> : null}
      {hasHypotheses || awaitingFirstHypothesis ? (
        <HypothesesPanel
          expanded={panelState.expanded}
          onExpandedChange={setExpanded}
          // No count before the first hypothesis: "0 plausible causes" reads
          // as a result rather than a wait.
          meta={
            hasHypotheses ? (
              <Fragment>
                {tn(
                  '%s plausible cause',
                  '%s plausible causes',
                  projection.hypotheses.length
                )}
                {' • '}
                {tn('%s check completed', '%s checks completed', completedChecks)}
              </Fragment>
            ) : null
          }
        >
          {hasHypotheses ? (
            <HypothesisList
              hypotheses={projection.hypotheses}
              primaryHypothesisId={projection.report.primaryHypothesisId}
              getActions={getActions}
            />
          ) : (
            <HypothesisListPlaceholder />
          )}
        </HypothesesPanel>
      ) : null}
    </Stack>
  );
}

/**
 * Shared by the row and its placeholder so the panel keeps its shape when the
 * first hypothesis lands — only its contents change.
 */
function HypothesesPanel({
  children,
  expanded,
  meta,
  onExpandedChange,
}: {
  children: React.ReactNode;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  meta?: React.ReactNode;
}) {
  return (
    <Disclosure
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      border="primary"
      radius="xl"
      background="secondary"
      data-test-id="investigation-run-panel"
    >
      <HypothesesTitle>
        <Stack gap="xs" minWidth={0}>
          <Text variant="muted" bold>
            {t('Hypotheses')}
          </Text>
          {meta ? (
            <Text variant="muted" density="comfortable" bold={false}>
              {meta}
            </Text>
          ) : null}
        </Stack>
      </HypothesesTitle>
      <HypothesesContent>{children}</HypothesesContent>
    </Disclosure>
  );
}

// The card carries no padding of its own: the header row runs edge to edge
// and the button inside it holds the padding, so the whole header is the hit
// area and the focus ring traces the card's corners rather than sitting inset
// in its padding.
//
// The `[data-disclosure] > *:has(> &)` rules style Disclosure's title row, the
// button's parent. Starting from the Disclosure root matters twice over: a
// nested selector that starts with `:` is glued onto the button's own class,
// so a bare `:has(> &)` never matches, and the extra attribute outranks the
// row's own single-class rules whichever stylesheet lands last.
const HypothesesTitle = styled(Disclosure.Title)`
  [data-disclosure] > *:has(> &) {
    padding: 0;
    border-radius: ${p => p.theme.radius.xl};
  }

  /* No hover or press background: the header is part of the card, and a tint
   * on it alone sets it apart from the body below when expanded. */
  /* The state goes before ":has()", one rule each: written as a list with the
   * state after ":has(> &)", stylis left the "&" unreplaced. */
  [data-disclosure] > *:hover:has(> &) {
    background: transparent;
  }

  [data-disclosure] > *:active:has(> &) {
    background: transparent;
  }

  /* Expanded, the header is only the top of the card. */
  [data-disclosure] > *:has(> &[aria-expanded='true']) {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  && {
    height: auto;
    padding: ${p => p.theme.space.lg};
    border-radius: inherit;
    white-space: normal;
    text-align: left;
  }

  && > span {
    height: auto;
    white-space: normal;
    align-items: flex-start;
  }
`;

// The header's bottom padding plus this top padding keeps the old `xl` gap
// between the tally and the first card.
const HypothesesContent = styled(Disclosure.Content)`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.lg} ${p => p.theme.space.lg};
`;
