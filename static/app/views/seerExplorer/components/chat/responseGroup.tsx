import {Fragment} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {MessageRow, ThinkingBlock} from '@sentry/scraps/chat';
import {Container} from '@sentry/scraps/layout';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {AgentWriteApprovalProvider} from 'sentry/components/seer/markdown/embeds/components/agentWriteApproval';
import {t} from 'sentry/locale';
import {callRecordLabel, visibleCallRecords} from 'sentry/views/seerExplorer/callRecords';
import type {
  Block,
  PendingUserInput,
  SeerExplorerRunId,
} from 'sentry/views/seerExplorer/types';
import {getToolsStringFromBlock} from 'sentry/views/seerExplorer/utils';

import {AssistantBlock} from './assistant';
import {MessagePlaceholder, hasValidContent} from './shared';
import {CODE_MODE_TOOLS, ToolCallList, blockRendersToolContent} from './toolUse';

/**
 * One assistant response: a run of consecutive `assistant`/`tool_use` blocks that follows a user
 * message. The server emits a turn as many blocks (a `tool_use` block per reasoning+tool step, then
 * a terminating `assistant` block with the answer), so grouping them here is what lets a whole
 * response collapse into a single `ThinkingBlock` instead of one row per step.
 */
interface ResponseSegment {
  blocks: Block[];
  /** Indices into the original flat block array, for stable keys and ref bookkeeping. */
  indices: number[];
  kind: 'response';
}

interface UserSegment {
  block: Block;
  index: number;
  kind: 'user';
}

export type TranscriptSegment = ResponseSegment | UserSegment;

/**
 * Partition the flat block list into user messages and assistant responses.
 *
 * A user block is its own segment; every maximal run of `assistant`/`tool_use` blocks after it is
 * one response. This mirrors how the run itself is streamed — see `useSeerExplorer`'s
 * `serverHasResponse`, which treats either role as "the assistant has started responding".
 */
export function groupTranscript(blocks: Block[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let current: ResponseSegment | null = null;

  blocks.forEach((block, index) => {
    if (block.message.role === 'user') {
      current = null;
      segments.push({kind: 'user', block, index});
      return;
    }
    if (current) {
      current.blocks.push(block);
      current.indices.push(index);
      return;
    }
    current = {kind: 'response', blocks: [block], indices: [index]};
    segments.push(current);
  });

  return segments;
}

/**
 * The terminal answer of a response, if any: the last block, when it is an `assistant` block that
 * carries real content. Its reasoning still belongs in the ThinkingBlock; only its content is
 * hoisted out as the visible answer.
 */
function finalAnswer(group: Block[]): Block | null {
  const last = group[group.length - 1];
  return last?.message.role === 'assistant' && hasValidContent(last.message.content)
    ? last
    : null;
}

/**
 * The most recent user-facing action within a block, or null when it did nothing worth naming.
 *
 * Prefers the Code Mode call records (their labels are what the rows show), then falls back to a
 * classic tool's label — skipping Code Mode's own tool names, which name nothing ("Used
 * sentry_api_execute tool"). Deliberately never reads `thinking_content`: the title is visible even
 * when the reasoning is toggled off, so it must not leak it.
 */
function latestBlockActivity(block: Block): string | null {
  const finished = (block.tool_results ?? []).flatMap(
    result => result?.structuredContent?.calls ?? []
  );
  const records = visibleCallRecords(
    finished.length ? finished : (block.live_calls ?? [])
  );
  for (let i = records.length - 1; i >= 0; i--) {
    const label = callRecordLabel(records[i]!);
    if (label) {
      return label;
    }
  }

  const calls = block.message.tool_calls ?? [];
  const labels = getToolsStringFromBlock(block);
  for (let i = labels.length - 1; i >= 0; i--) {
    if (labels[i] && !CODE_MODE_TOOLS.has(calls[i]?.function ?? '')) {
      return labels[i]!;
    }
  }

  return null;
}

/**
 * A live summary for the response's ThinkingBlock: the latest thing the agent did (the current tool
 * while streaming), which updates step to step so `ThinkingBlock`'s decode animation replays. Falls
 * back to a plain "Thinking" before any tool has run.
 */
export function deriveThinkingTitle(group: Block[]): string {
  for (let i = group.length - 1; i >= 0; i--) {
    const label = latestBlockActivity(group[i]!);
    if (label) {
      return label;
    }
  }
  return t('Thinking');
}

interface ResponseGroupProps {
  blockIndex: number;
  group: Block[];
  blocks?: Block[];
  getPageReferrer?: () => string;
  interactionPending?: boolean;
  pendingInput?: PendingUserInput | null;
  readOnly?: boolean;
  respondToUserInput?: (inputId: string, responseData?: Record<string, unknown>) => void;
  runId?: SeerExplorerRunId;
  showThinking?: boolean;
}

/**
 * Renders one assistant response as a single top-level `ThinkingBlock` — reasoning, intermediate
 * narration, and every tool call interleaved in run order inside it — followed by the final answer
 * as a sibling. Replaces the previous one-row-per-block rendering that produced a wall of separate
 * "Thinking" and tool-call rows for a single turn.
 */
export function ResponseGroup({
  group,
  blockIndex,
  blocks,
  getPageReferrer,
  interactionPending,
  pendingInput,
  readOnly,
  respondToUserInput,
  runId,
  showThinking,
}: ResponseGroupProps) {
  const answer = finalAnswer(group);
  const active = group.some(block => block.loading);

  // The reasoning trace is everything except the answer's content: thinking prose (gated on the
  // `showThinking` toggle), any intermediate narration, and the tool calls.
  const hasTrace = group.some(block => {
    const isAnswer = block === answer;
    return (
      (showThinking && hasValidContent(block.message.thinking_content)) ||
      (!isAnswer && hasValidContent(block.message.content)) ||
      // Not `tool_calls.length`: a call that reported nothing renders no row, and counting it
      // opens a reasoning box with an empty body.
      blockRendersToolContent(block, blocks)
    );
  });

  const startTime = new Date(group[0]!.timestamp);
  // Keep ThinkingBlock expanded while the response is still in progress — either a tool is
  // running, or the LLM is between tool calls (loading without tool_calls yet). Without
  // this, the block collapses and reopens on each poll cycle when the agent retries a
  // failing tool call, causing a visible flash.
  const endTime =
    (active && !answer) || pendingInput
      ? undefined
      : new Date(group[group.length - 1]!.timestamp);

  return (
    <Container width="100%" position="relative" flexShrink={0} data-block-wrapper="">
      <motion.div initial={{opacity: 0, x: 10}} animate={{opacity: 1, x: 0}}>
        <AgentWriteApprovalProvider
          pendingInput={pendingInput ?? null}
          readOnly={readOnly ?? false}
          respondToUserInput={respondToUserInput}
        >
          {/* Show loading placeholder when response is streaming but has no visible content yet */}
          {active && !hasTrace && !answer ? <MessagePlaceholder /> : null}

          {hasTrace ? (
            <MessageRow from="assistant" density="compact">
              <ThinkingBlock
                title={deriveThinkingTitle(group)}
                startTime={startTime}
                endTime={endTime}
              >
                {group.map((block, i) => {
                  const isAnswer = block === answer;
                  // A block's own tool calls render after its thinking, so they count as "after";
                  // "before" is an earlier block's tool calls. Thinking that is flanked on both
                  // sides gets extra breathing room to set it apart; leading/trailing thinking does
                  // not, so it stays tight against the answer or the block edge.
                  const toolCallBefore = group
                    .slice(0, i)
                    .some(b => Boolean(b.message.tool_calls?.length));
                  const toolCallAtOrAfter = group
                    .slice(i)
                    .some(b => Boolean(b.message.tool_calls?.length));
                  const thinkingBetweenToolCalls = toolCallBefore && toolCallAtOrAfter;
                  return (
                    <Fragment key={block.id}>
                      {showThinking &&
                        hasValidContent(block.message.thinking_content) && (
                          <ThinkingProse data-spaced={thinkingBetweenToolCalls}>
                            <SeerMarkdown raw={block.message.thinking_content} />
                          </ThinkingProse>
                        )}
                      {!isAnswer && hasValidContent(block.message.content) && (
                        <SeerMarkdown raw={block.message.content} />
                      )}
                      {block.message.tool_calls ? (
                        <ToolCallList
                          block={block}
                          blocks={blocks}
                          getPageReferrer={getPageReferrer}
                        />
                      ) : null}
                    </Fragment>
                  );
                })}
              </ThinkingBlock>
            </MessageRow>
          ) : null}

          {answer ? (
            <AssistantBlock
              block={answer}
              blockIndex={blockIndex + group.length - 1}
              runId={runId}
              interactionPending={interactionPending}
              readOnly={readOnly}
            />
          ) : null}
        </AgentWriteApprovalProvider>
      </motion.div>
    </Container>
  );
}

// The response's raw reasoning. When it sits between tool calls it is set apart with extra vertical
// space (`data-spaced`); leading or trailing reasoning gets none so it stays tight against the
// answer or the block edge.
const ThinkingProse = styled('div')`
  min-width: 0;
  font-family: ${p => p.theme.font.family.sans};
  font-size: ${p => p.theme.font.size.sm};

  &[data-spaced='true'] {
    padding-block: ${p => p.theme.space.lg};
  }

  & > :first-child {
    margin-top: 0;
  }
  & > :last-child {
    margin-bottom: 0;
  }
`;
