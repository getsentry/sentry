import {Fragment, memo} from 'react';
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
import {hasValidContent} from './shared';
import {
  CODE_MODE_TOOLS,
  ToolCallList,
  blockRendersToolContent,
  type LatestTodos,
} from './toolUse';

const TOOL_SUMMARY_TAG = /\{%\s+tool_summary\s+%\}([\s\S]*?)\{%\s+\/tool_summary\s+%\}/g;

function latestToolSummary(group: Block[]): string | null {
  for (let i = group.length - 1; i >= 0; i--) {
    const content = group[i]?.message.content;
    if (!content) {
      continue;
    }
    const summaries = [...content.matchAll(TOOL_SUMMARY_TAG)];
    const summary = summaries.at(-1)?.[1]?.trim();
    if (summary) {
      return summary;
    }
  }
  return null;
}

function hasVisibleContent(content: string | null | undefined): content is string {
  return hasValidContent(
    content?.replace(TOOL_SUMMARY_TAG, '').replace(/\{%\s+tool_summary\b[\s\S]*$/, '')
  );
}

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
  return last?.message.role === 'assistant' && hasVisibleContent(last.message.content)
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
  const summary = latestToolSummary(group);
  if (summary) {
    return summary;
  }
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
  getPageReferrer?: () => string;
  interactionPending?: boolean;
  /** The conversation's newest todo snapshot, from `findLatestTodos`. */
  latestTodos?: LatestTodos | null;
  pendingInput?: PendingUserInput | null;
  readOnly?: boolean;
  respondToUserInput?: (inputId: string, responseData?: Record<string, unknown>) => void;
  runId?: SeerExplorerRunId;
  showThinking?: boolean;
}

/**
 * Every poll rebuilds the transcript's arrays, so `group` is a fresh array even when none of its
 * blocks changed. Compare it element-wise so a settled response skips re-rendering (and re-parsing
 * its markdown) while a later one streams.
 */
function areResponseGroupPropsEqual(prev: ResponseGroupProps, next: ResponseGroupProps) {
  for (const key of Object.keys(next) as Array<keyof ResponseGroupProps>) {
    if (key !== 'group' && prev[key] !== next[key]) {
      return false;
    }
  }
  return (
    Object.keys(prev).length === Object.keys(next).length &&
    prev.group.length === next.group.length &&
    prev.group.every((block, i) => block === next.group[i])
  );
}

/**
 * Renders one assistant response as a single top-level `ThinkingBlock` — reasoning, intermediate
 * narration, and every tool call interleaved in run order inside it — followed by the final answer
 * as a sibling. Replaces the previous one-row-per-block rendering that produced a wall of separate
 * "Thinking" and tool-call rows for a single turn.
 */
export const ResponseGroup = memo(function ResponseGroup({
  group,
  blockIndex,
  latestTodos,
  getPageReferrer,
  interactionPending,
  pendingInput,
  readOnly,
  respondToUserInput,
  runId,
  showThinking,
}: ResponseGroupProps) {
  // `answer` identifies the block whose content is the visible response — used to exclude it
  // from the ThinkingBlock trace. `settledAnswer` is the same block once it has finished
  // loading — only then is it rendered outside the ThinkingBlock as the actual reply. While
  // still loading, neither its content nor a MessagePlaceholder leaks into view.
  const answer = finalAnswer(group);
  const settledAnswer = answer && !answer.loading ? answer : null;
  const active = group.some(block => block.loading);
  const toolSummary = latestToolSummary(group);

  // The reasoning trace is everything except the answer's content: thinking prose (gated on the
  // `showThinking` toggle), any intermediate narration, and the tool calls.
  const hasTrace = group.some(block => {
    const isAnswer = block === answer;
    return (
      (showThinking && hasValidContent(block.message.thinking_content)) ||
      (!isAnswer && hasVisibleContent(block.message.content)) ||
      // Not `tool_calls.length`: a call that reported nothing renders no row, and counting it
      // opens a reasoning box with an empty body.
      blockRendersToolContent(block, latestTodos)
    );
  });

  const startTime = new Date(group[0]!.timestamp);
  // `settledAnswer` is the stable "response is done" signal. `block.loading` flickers false
  // between tool calls, but answer settles once
  const endTime =
    !settledAnswer || pendingInput
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
          {active || hasTrace || toolSummary ? (
            <MessageRow from="assistant" density="compact">
              <ThinkingBlock
                title={deriveThinkingTitle(group)}
                completedTitle={toolSummary ?? undefined}
                startTime={startTime}
                endTime={endTime}
              >
                {/* `hasTrace`, not `active`: an active response with nothing to show yet still
                    maps to a non-empty array of blocks that each render nothing, and an array is
                    truthy, so ThinkingBlock would open its bordered panel around no content. */}
                {hasTrace
                  ? group.map((block, i) => {
                      const isAnswer = block === answer;
                      // A block's own tool calls render after its thinking, so they count as
                      // "after"; "before" is an earlier block's tool calls. Thinking that is
                      // flanked on both sides gets extra breathing room to set it apart;
                      // leading/trailing thinking does not, so it stays tight against the answer
                      // or the block edge.
                      const toolCallBefore = group
                        .slice(0, i)
                        .some(b => Boolean(b.message.tool_calls?.length));
                      const toolCallAtOrAfter = group
                        .slice(i)
                        .some(b => Boolean(b.message.tool_calls?.length));
                      const thinkingBetweenToolCalls =
                        toolCallBefore && toolCallAtOrAfter;
                      return (
                        <Fragment key={block.id}>
                          {showThinking &&
                            hasValidContent(block.message.thinking_content) && (
                              <ThinkingProse data-spaced={thinkingBetweenToolCalls}>
                                <SeerMarkdown raw={block.message.thinking_content} />
                              </ThinkingProse>
                            )}
                          {!isAnswer && hasVisibleContent(block.message.content) && (
                            <SeerMarkdown raw={block.message.content} />
                          )}
                          {block.message.tool_calls ? (
                            <ToolCallList
                              block={block}
                              latestTodos={latestTodos}
                              getPageReferrer={getPageReferrer}
                            />
                          ) : null}
                        </Fragment>
                      );
                    })
                  : null}
              </ThinkingBlock>
            </MessageRow>
          ) : null}

          {settledAnswer ? (
            <AssistantBlock
              block={settledAnswer}
              blockIndex={blockIndex + group.length - 1}
              runId={runId}
              interactionPending={interactionPending}
              readOnly={readOnly}
              compact={hasTrace}
            />
          ) : null}
        </AgentWriteApprovalProvider>
      </motion.div>
    </Container>
  );
}, areResponseGroupPropsEqual);

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
