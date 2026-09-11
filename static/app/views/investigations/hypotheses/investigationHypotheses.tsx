import {uuid4} from '@sentry/core';
import {useQuery} from '@tanstack/react-query';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  investigationOrchestrationQueryOptions,
  useInvestigationOrchestrationCommandMutation,
} from 'sentry/views/investigations/api';
import {HypothesisList} from 'sentry/views/investigations/hypotheses/hypothesisList';
import type {
  InvestigationHypothesis,
  InvestigationOrchestration,
} from 'sentry/views/investigations/types';

/** How often to re-read the projection while a workflow is still moving. */
const POLL_INTERVAL_MS = 2000;

/**
 * Whether the workflow has stopped moving on its own. `awaiting_input` is
 * deliberately not settled: the run resumes as soon as input arrives, which may
 * happen from another surface, so polling has to continue.
 */
function isInvestigationRunSettled(
  projection: InvestigationOrchestration | undefined
): boolean {
  if (!projection) {
    return false;
  }
  return (
    projection.status === 'completed' ||
    projection.status === 'failed' ||
    projection.status === 'cancelled'
  );
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
  const {data: projection} = useQuery({
    ...investigationOrchestrationQueryOptions(organization.slug, investigationId),
    enabled,
    refetchInterval: query =>
      isInvestigationRunSettled(query.state.data?.json) ? false : POLL_INTERVAL_MS,
  });

  const commandMutation = useInvestigationOrchestrationCommandMutation(
    organization.slug,
    investigationId
  );

  if (!projection?.hypotheses?.length) {
    return null;
  }

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

  return (
    <HypothesisList
      hypotheses={projection.hypotheses}
      primaryHypothesisId={projection.report.primaryHypothesisId}
      getActions={getActions}
    />
  );
}
