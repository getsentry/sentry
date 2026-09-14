import {useState} from 'react';
import {uuid4} from '@sentry/core';
import {useQuery} from '@tanstack/react-query';

import {Container, Stack} from '@sentry/scraps/layout';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  investigationOrchestrationQueryOptions,
  useInvestigationOrchestrationCommandMutation,
} from 'sentry/views/investigations/api';
import {HypothesisList} from 'sentry/views/investigations/hypotheses/hypothesisList';
import {getSeerStatusBlock} from 'sentry/views/investigations/statusBlock/getSeerStatusBlock';
import {SeerStatusBlock} from 'sentry/views/investigations/statusBlock/seerStatusBlock';
import type {
  InvestigationHypothesis,
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
 * Statuses where the agent is not going to move on its own. The first three
 * have stopped for good; `awaiting_input` has stopped recoverably, blocked on a
 * person.
 */
const STOPPED_STATUSES = new Set<string>([
  'completed',
  'failed',
  'cancelled',
  'awaiting_input',
]);

/**
 * Whether a run is still advancing, and so worth polling.
 *
 * `awaiting_input` counts as stopped even though it can resume: an
 * investigation created without a prompt starts there and stays there until
 * someone supplies one, so polling it would be a permanent two-second request
 * loop on a run nobody is driving. Supplying input from this client writes the
 * new projection straight into the cache, which starts it again.
 *
 * Exported because the detail view decides from the summary served alongside
 * the investigation and this component from the full projection — the same
 * statuses either way.
 */
export function shouldPollInvestigationRun(
  status: InvestigationOrchestrationStatus | undefined
): boolean {
  return status === undefined || !STOPPED_STATUSES.has(status);
}

type InvestigationHypothesesProps = {
  investigationId: string;
  /**
   * Set false for an investigation with no agentic run behind it — the
   * orchestration endpoint 404s for those, and there is nothing to poll.
   */
  enabled?: boolean;
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
}: InvestigationHypothesesProps) {
  const organization = useOrganization();
  // When the last accepted command was sent, or null if none has been. A
  // command makes a settled run interesting again, because Seer is about to
  // rewrite the projection behind it.
  const [commandSentAt, setCommandSentAt] = useState<number | null>(null);

  const {data: projection} = useQuery({
    ...investigationOrchestrationQueryOptions(organization.slug, investigationId),
    enabled,
    refetchInterval: query => {
      if (shouldPollInvestigationRun(query.state.data?.json.status)) {
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

  // The status block is the run talking, so it appears as soon as there is a
  // run — before the first hypothesis exists, which is exactly when a viewer
  // most needs to be told that something is happening.
  if (!projection) {
    return null;
  }

  const statusBlock = getSeerStatusBlock(projection);
  const {workflowVersion} = projection;
  const commandPending = commandMutation.isPending;

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

  // The status block and the hypotheses are one object on the page: the block
  // says what the run is doing and the cards are what it is doing it to. The
  // panel is what makes that legible — without it the block reads as a
  // page-level banner that happens to sit above an unrelated row.
  return (
    <Container
      border="primary"
      radius="md"
      background="secondary"
      padding="xl"
      data-test-id="investigation-run-panel"
    >
      <Stack gap="xl">
        {statusBlock ? <SeerStatusBlock {...statusBlock} /> : null}
        <HypothesisList
          hypotheses={projection.hypotheses}
          primaryHypothesisId={projection.report.primaryHypothesisId}
          getActions={getActions}
        />
      </Stack>
    </Container>
  );
}
