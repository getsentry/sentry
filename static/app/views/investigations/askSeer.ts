import {t} from 'sentry/locale';
import {isSeerExplorerEnabled} from 'sentry/utils/seer/isSeerExplorerEnabled';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  InvestigationBlock,
  InvestigationDetail,
  InvestigationHypothesis,
  InvestigationOrchestration,
} from 'sentry/views/investigations/types';
import {
  useSeerExplorerContext,
  type SeerExplorerContextValue,
} from 'sentry/views/seerExplorer/useSeerExplorerContext';

type InvestigationChatPrompt = Parameters<SeerExplorerContextValue['openChatPrompt']>[0];

/**
 * "Ask Seer" about an investigation, one of its hypotheses, or one of its
 * cells: Seer Agent opens on a question from Seer, and the user's reply carries
 * what that question is about as context, the way a dashboard widget's "Ask
 * Seer" does. Refining a cell or steering the investigation happens in that
 * chat.
 *
 * Returns undefined where that isn't available, and callers leave out their
 * "Ask Seer" entry point.
 */
export function useInvestigationAskSeer():
  | ((prompt: InvestigationChatPrompt) => void)
  | undefined {
  const organization = useOrganization();
  const {openChatPrompt} = useSeerExplorerContext();

  const isAvailable =
    // The chat endpoint drops the question and its context without this flag.
    organization.features.includes('seer-explorer-chat-prompts') &&
    isSeerExplorerEnabled(organization);

  return isAvailable ? openChatPrompt : undefined;
}

export function getInvestigationChatPrompt({
  blocks,
  investigation,
  orchestration,
}: {
  /** The cells on screen, in order. */
  blocks: InvestigationBlock[];
  investigation: InvestigationDetail;
  orchestration: InvestigationOrchestration | undefined;
}): InvestigationChatPrompt {
  return {
    prompt: t('What would you like to know about this investigation?'),
    context: {
      investigation: {
        ...getInvestigationReference(investigation),
        sourceType: investigation.sourceType,
        summary: investigation.summary,
        summaryDescription: investigation.summaryDescription,
        runStatus: orchestration?.status,
        runPhase: orchestration?.phase,
      },
      hypotheses: orchestration?.hypotheses.map(hypothesis =>
        getHypothesisContext(hypothesis, orchestration.report.primaryHypothesisId)
      ),
      cells: blocks.map(getCellContext),
    },
  };
}

export function getHypothesisChatPrompt({
  hypothesis,
  investigation,
  primaryHypothesisId,
}: {
  hypothesis: InvestigationHypothesis;
  investigation: InvestigationDetail;
  primaryHypothesisId: string | null;
}): InvestigationChatPrompt {
  return {
    prompt: t('What would you like to know about this hypothesis?'),
    context: {
      investigation: getInvestigationReference(investigation),
      hypothesis: {
        ...getHypothesisContext(hypothesis, primaryHypothesisId),
        verificationSteps: hypothesis.verificationSteps?.map(step => ({
          title: step.title,
          objective: step.objective,
          status: step.status,
          result: step.result,
        })),
        evidence: hypothesis.evidence.map(evidence => ({
          kind: evidence.kind,
          title: evidence.title,
          summary: evidence.summary,
          url: evidence.url,
        })),
      },
    },
  };
}

export function getCellChatPrompt({
  block,
  investigation,
}: {
  block: InvestigationBlock;
  investigation: InvestigationDetail;
}): InvestigationChatPrompt {
  return {
    prompt: block.title
      ? t('How would you like to refine or explore "%s"?', block.title)
      : t('How would you like to refine or explore this cell?'),
    context: {
      investigation: getInvestigationReference(investigation),
      cell: {
        ...getCellContext(block),
        // What the cell was asked to show, which is what a refinement changes.
        request: block.generationPrompt || undefined,
      },
    },
  };
}

function getInvestigationReference(investigation: InvestigationDetail) {
  return {
    id: investigation.id,
    title: investigation.title,
    version: investigation.version,
  };
}

function getHypothesisContext(
  hypothesis: InvestigationHypothesis,
  primaryHypothesisId: string | null
) {
  return {
    // What Seer needs to act on this hypothesis, not just talk about it.
    id: hypothesis.id,
    // `order` is zero-based; the page labels this "Hypothesis <number>".
    number: hypothesis.order + 1,
    statement: hypothesis.statement,
    rationale: hypothesis.rationale,
    status: hypothesis.effectiveStatus,
    confidence: hypothesis.confidence,
    isConclusion: hypothesis.id === primaryHypothesisId || undefined,
    verdict: hypothesis.agentVerdict
      ? {
          verdict: hypothesis.agentVerdict.verdict,
          rationale: hypothesis.agentVerdict.rationale,
          remainingGaps: hypothesis.agentVerdict.remainingGaps,
        }
      : undefined,
    error: hypothesis.error?.message,
  };
}

/**
 * The cell as it renders: its persisted output, or the content an older text
 * cell carries in its place.
 */
function getCellContext(block: InvestigationBlock) {
  return {
    // What Seer needs to refine this cell, not just talk about it.
    id: block.id,
    version: block.version,
    title: block.title,
    kind: block.kind,
    output: block.output ?? (block.content.trim() ? {markdown: block.content} : null),
  };
}
