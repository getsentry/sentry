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
 * blocks: Seer Agent opens on a question from Seer, and the user's reply carries
 * what that question is about as context, the way a dashboard widget's "Ask
 * Seer" does. Refining a block or steering the investigation happens in that
 * chat.
 *
 * The context is what that thing reports to the LLM context tree: the
 * investigation page registers an "investigation" node, and its hypotheses and
 * blocks register their own nodes beneath it.
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
 * Which investigation a block or hypothesis belongs to, for an "Ask Seer" about
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
    // Active or archived; where the run is lives in runStatus and runPhase.
    status: investigation.status,
    projectIds: investigation.projectIds,
    sourceType: investigation.sourceType,
    // What it was started from, like a metric alert's open period.
    sourceRef: investigation.source?.ref,
    summary: investigation.summary,
    summaryDescription: investigation.summaryDescription,
    // The investigation carries where the run was until the full run arrives.
    runStatus: orchestration?.status ?? investigation.orchestration?.status,
    runPhase: orchestration?.phase ?? investigation.orchestration?.phase,
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
 * How much of a block's result its node carries, the same cut
 * `_completion_block_context` in `src/sentry/investigations/agent.py` makes. A
 * query's table can run to 100k characters, and every chat on the page sends
 * every block on screen.
 */
const BLOCK_OUTPUT_MAX_CHARS = 4000;

/**
 * A block's result as text: a query's table, or a text block's markdown, which
 * an older text block carries as its content instead.
 */
function getBlockOutputText(block: InvestigationBlock): string {
  const {output} = block;
  if (output && typeof output === 'object') {
    if ('tableMarkdown' in output && typeof output.tableMarkdown === 'string') {
      return output.tableMarkdown;
    }
    if ('markdown' in output && typeof output.markdown === 'string') {
      return output.markdown;
    }
  }
  return block.content;
}

/**
 * The data of an "investigation-block" node: the block as it renders, cut to
 * the start of its result.
 */
export function getBlockLLMContext(block: InvestigationBlock) {
  const output = getBlockOutputText(block).trim();
  return {
    // What Seer needs to refine this block, not just talk about it.
    id: block.id,
    version: block.version,
    // Nodes list in the order they mounted, and a block can mount after the
    // ones below it, once it has a result to show.
    position: block.position,
    title: block.title,
    kind: block.kind,
    output: output.slice(0, BLOCK_OUTPUT_MAX_CHARS) || null,
    // So Seer reads the block for the rest instead of taking this as all of it.
    outputTruncated: output.length > BLOCK_OUTPUT_MAX_CHARS || undefined,
    // What the block was asked to show, which is what a refinement changes.
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
