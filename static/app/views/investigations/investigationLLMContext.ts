import {isSeerExplorerEnabled} from 'sentry/utils/seer/isSeerExplorerEnabled';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  InvestigationBlock,
  InvestigationDetail,
  InvestigationHypothesis,
  InvestigationOrchestration,
} from 'sentry/views/investigations/types';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';
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
 * The context is what that thing reports to the LLM context tree: the
 * investigation page registers an "investigation" node, and its hypotheses and
 * cells register their own nodes beneath it.
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

/**
 * Which investigation a cell or hypothesis belongs to, for an "Ask Seer" about
 * one of them.
 */
export function getInvestigationReference(investigation: InvestigationDetail) {
  return {
    id: investigation.id,
    title: investigation.title,
    version: investigation.version,
  };
}

/** The data of the investigation page's "investigation" node. */
export function getInvestigationLLMContext(
  investigation: InvestigationDetail,
  orchestration: InvestigationOrchestration | undefined
) {
  return {
    ...getInvestigationReference(investigation),
    sourceType: investigation.sourceType,
    summary: investigation.summary,
    summaryDescription: investigation.summaryDescription,
    runStatus: orchestration?.status,
    runPhase: orchestration?.phase,
  };
}

/**
 * The data of an "investigation-hypothesis" node: the hypothesis as its card
 * shows it.
 */
export function getHypothesisLLMContext(
  hypothesis: InvestigationHypothesis,
  isConclusion: boolean
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
    isConclusion: isConclusion || undefined,
    verdict: hypothesis.agentVerdict
      ? {
          verdict: hypothesis.agentVerdict.verdict,
          rationale: hypothesis.agentVerdict.rationale,
          remainingGaps: hypothesis.agentVerdict.remainingGaps,
        }
      : undefined,
    error: hypothesis.error?.message,
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
  };
}

/**
 * The data of an "investigation-cell" node: the cell as it renders, which is
 * its persisted output or the content an older text cell carries in its place.
 */
export function getCellLLMContext(block: InvestigationBlock) {
  return {
    // What Seer needs to refine this cell, not just talk about it.
    id: block.id,
    version: block.version,
    // Nodes list in the order they mounted, and a cell can mount after the
    // ones below it, once it has a result to show.
    position: block.position,
    title: block.title,
    kind: block.kind,
    output: block.output ?? (block.content.trim() ? {markdown: block.content} : null),
    // What the cell was asked to show, which is what a refinement changes.
    request: block.generationPrompt || undefined,
  };
}

function HypothesisLLMContextInner({
  hypothesis,
  isConclusion,
}: {
  hypothesis: InvestigationHypothesis;
  isConclusion: boolean;
}) {
  useLLMContext(getHypothesisLLMContext(hypothesis, isConclusion));
  return null;
}

/**
 * Reports a hypothesis card. Renders nothing, so it can sit inside the card's
 * `<li>` rather than putting the registry's element between it and its list.
 */
export const HypothesisLLMContext = registerLLMContext(
  'investigation-hypothesis',
  HypothesisLLMContextInner
);
