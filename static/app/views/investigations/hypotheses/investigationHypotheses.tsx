import {useState} from 'react';
import {IconEllipsis} from '@sentry/icons/ellipsis';
import {useQuery} from '@tanstack/react-query';

import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {SeerEmbedBlock} from 'sentry/components/seer/markdown/embeds/components/seerEmbedBlock';
import {t, tn} from 'sentry/locale';
import {humanize} from 'sentry/utils/string/humanize';
import {useOrganization} from 'sentry/utils/useOrganization';
import {investigationOrchestrationQueryOptions} from 'sentry/views/investigations/api';
import {
  HypothesisList,
  HypothesisListPlaceholder,
} from 'sentry/views/investigations/hypotheses/hypothesisList';
import {getSeerStatusBlock} from 'sentry/views/investigations/statusBlock/getSeerStatusBlock';
import {SeerStatusBlock} from 'sentry/views/investigations/statusBlock/seerStatusBlock';
import type {
  InvestigationHypothesis,
  InvestigationHypothesisStatus,
  InvestigationOrchestrationPhase,
  InvestigationOrchestrationStatus,
} from 'sentry/views/investigations/types';

/** How often to re-read the projection while a workflow is still moving. */
const POLL_INTERVAL_MS = 2000;

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
  /** Lets the page outline scroll to the hypotheses. */
  id?: string;
  /**
   * Adds "Ask Seer" to each hypothesis's menu. Left out where Seer Agent can't
   * take the question, and the cards show no menu.
   */
  onAskSeer?: (hypothesis: InvestigationHypothesis) => void;
  /**
   * Adds "Ask Seer" to the panel's menu, about every hypothesis at once. Left
   * out where Seer Agent can't take the question, and the panel shows no menu.
   */
  onAskSeerAboutHypotheses?: (hypotheses: InvestigationHypothesis[]) => void;
  /**
   * The run's phase from the investigation summary. Only used before the
   * projection arrives, so a finished run opens collapsed instead of showing a
   * placeholder that collapses a moment later. Optional: the projection
   * replaces it as soon as it lands.
   */
  phase?: InvestigationOrchestrationPhase;
  /**
   * The run's status from the investigation summary, read the same way as
   * `phase`: only until the projection arrives.
   */
  status?: InvestigationOrchestrationStatus;
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
 * Steering travels back through Seer Agent: "Ask Seer" on a card or on the
 * panel opens a chat about it, and the agent acts on the run from there.
 */
export function InvestigationHypotheses({
  enabled = true,
  id,
  investigationId,
  onAskSeer,
  onAskSeerAboutHypotheses,
  phase: summaryPhase,
  status: summaryStatus,
}: InvestigationHypothesesProps) {
  const organization = useOrganization();

  const {
    data: projection,
    dataUpdatedAt,
    isPending,
  } = useQuery({
    ...investigationOrchestrationQueryOptions(organization.slug, investigationId),
    enabled,
    refetchInterval: query => {
      const run = query.state.data?.json;
      return shouldPollInvestigationRun(run?.status, run?.runId !== null)
        ? POLL_INTERVAL_MS
        : false;
    },
  });

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
  // panel would open on placeholders and then collapse. So is a run waiting on
  // a person — nothing will arrive until they answer.
  if (!projection) {
    const worthHoldingSpaceFor =
      enabled &&
      isPending &&
      summaryStatus !== 'awaiting_input' &&
      !SETTLED_PHASES.has(phase ?? '');

    return worthHoldingSpaceFor ? (
      <Stack gap="3xl">
        <HypothesesPanel expanded={panelState.expanded} onExpandedChange={setExpanded}>
          <HypothesisListPlaceholder />
        </HypothesesPanel>
      </Stack>
    ) : null;
  }

  // A finished run has nothing left to report here: the findings below speak
  // for themselves, and the header badge still says it completed. Every other
  // state — running, waiting on input, failed, stopped — keeps the block.
  const seerStatus = getSeerStatusBlock(projection, dataUpdatedAt);
  const statusBlock = seerStatus?.variant === 'complete' ? null : seerStatus;

  function getActions(hypothesis: InvestigationHypothesis): MenuItemProps[] {
    return onAskSeer
      ? [{key: 'ask-seer', label: t('Ask Seer'), onAction: () => onAskSeer(hypothesis)}]
      : [];
  }

  const hasHypotheses = projection.hypotheses.length > 0;
  // A run waiting on a person makes no hypotheses until they answer, so a
  // placeholder there would promise cards that are not coming.
  const awaitingFirstHypothesis =
    !hasHypotheses &&
    projection.status !== 'awaiting_input' &&
    !SETTLED_PHASES.has(projection.phase);

  return (
    <Stack id={id} gap="3xl">
      {statusBlock ? <SeerStatusBlock {...statusBlock} /> : null}
      {hasHypotheses || awaitingFirstHypothesis ? (
        <HypothesesPanel
          expanded={panelState.expanded}
          hypotheses={projection.hypotheses}
          onAskSeer={
            hasHypotheses && onAskSeerAboutHypotheses
              ? () => onAskSeerAboutHypotheses(projection.hypotheses)
              : undefined
          }
          onExpandedChange={setExpanded}
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
 * first hypothesis lands — only its contents change. Uses the same card as the
 * report's query blocks.
 */
function HypothesesPanel({
  children,
  expanded,
  hypotheses = [],
  onAskSeer,
  onExpandedChange,
}: {
  children: React.ReactNode;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  hypotheses?: InvestigationHypothesis[];
  onAskSeer?: () => void;
}) {
  const tally = getHypothesisTally(hypotheses);

  return (
    <SeerEmbedBlock
      actions={
        onAskSeer ? (
          <DropdownMenu
            position="bottom-end"
            usePortal
            trigger={triggerProps => (
              <OverlayTrigger.IconButton
                {...triggerProps}
                size="zero"
                variant="transparent"
                icon={<IconEllipsis size="xs" />}
                aria-label={t('Actions for hypotheses')}
              />
            )}
            items={[{key: 'ask-seer', label: t('Ask Seer'), onAction: onAskSeer}]}
          />
        ) : null
      }
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      status={
        tally ? (
          <Text size="sm" variant="muted" bold={false} wrap="nowrap">
            {tally}
          </Text>
        ) : null
      }
      testId="investigation-run-panel"
      title={t('Hypotheses')}
    >
      {children}
    </SeerEmbedBlock>
  );
}

/**
 * Order and labels for the tally. Pending and investigating count together.
 */
const TALLY_ORDER: Array<{
  label: (count: number) => string;
  statuses: InvestigationHypothesisStatus[];
}> = [
  {statuses: ['supported'], label: count => tn('%s supported', '%s supported', count)},
  {statuses: ['accepted'], label: count => tn('%s accepted', '%s accepted', count)},
  {
    statuses: ['inconclusive'],
    label: count => tn('%s inconclusive', '%s inconclusive', count),
  },
  {statuses: ['refuted'], label: count => tn('%s refuted', '%s refuted', count)},
  {statuses: ['rejected'], label: count => tn('%s rejected', '%s rejected', count)},
  {statuses: ['failed'], label: count => tn('%s failed', '%s failed', count)},
  {statuses: ['cancelled'], label: count => tn('%s cancelled', '%s cancelled', count)},
  {
    statuses: ['pending', 'investigating'],
    label: count => tn('%s investigating', '%s investigating', count),
  },
];

/**
 * Counts verdicts for the panel header, e.g. "1 supported • 2 refuted".
 * Statuses missing from `TALLY_ORDER` are counted under their own name.
 */
function getHypothesisTally(hypotheses: InvestigationHypothesis[]): string | null {
  if (hypotheses.length === 0) {
    return null;
  }
  const counts = new Map<InvestigationHypothesisStatus, number>();
  for (const {effectiveStatus} of hypotheses) {
    counts.set(effectiveStatus, (counts.get(effectiveStatus) ?? 0) + 1);
  }
  const known = new Set(TALLY_ORDER.flatMap(entry => entry.statuses));
  const parts = TALLY_ORDER.flatMap(({label, statuses}) => {
    const count = statuses.reduce(
      (total, status) => total + (counts.get(status) ?? 0),
      0
    );
    return count > 0 ? [label(count)] : [];
  });
  for (const [status, count] of counts) {
    if (!known.has(status)) {
      parts.push(`${count} ${humanize(status).toLowerCase()}`);
    }
  }
  // Only the parts are translated; the bullet is punctuation.
  return parts.join(' • ');
}
