import {Fragment} from 'react';
import {motion} from 'framer-motion';

import {MessageRow, ThinkingBlock} from '@sentry/scraps/chat';
import {Container} from '@sentry/scraps/layout';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {AgentWriteApprovalProvider} from 'sentry/components/seer/markdown/embeds/components/agentWriteApproval';
import {t} from 'sentry/locale';
import type {
  Block,
  PendingUserInput,
  SeerExplorerRunId,
} from 'sentry/views/seerExplorer/types';

import {AssistantBlock} from './assistant';
import {hasValidContent} from './shared';
import {ToolCallList} from './toolUse';

/**
 * One assistant response: a run of consecutive `assistant`/`tool_use` blocks that follows a user
 * message. The server emits a turn as many blocks (a `tool_use` block per reasoning+tool step, then
 * a terminating `assistant` block with the answer), so grouping them here is what lets a whole
 * response collapse into a single `ThinkingBlock` instead of one row per step.
 */
export interface ResponseSegment {
  blocks: Block[];
  /** Indices into the original flat block array, for stable keys and ref bookkeeping. */
  indices: number[];
  kind: 'response';
}

export interface UserSegment {
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
      Boolean(block.message.tool_calls?.length)
    );
  });

  const startTime = new Date(group[0]!.timestamp);
  const endTime = active ? undefined : new Date(group[group.length - 1]!.timestamp);

  return (
    <Container width="100%" position="relative" flexShrink={0} data-block-wrapper="">
      <motion.div initial={{opacity: 0, x: 10}} animate={{opacity: 1, x: 0}}>
        <AgentWriteApprovalProvider
          pendingInput={pendingInput ?? null}
          readOnly={readOnly ?? false}
          respondToUserInput={respondToUserInput}
        >
          {hasTrace ? (
            <MessageRow from="assistant" density="compact">
              <ThinkingBlock
                title={t('Thinking')}
                startTime={startTime}
                endTime={endTime}
              >
                {group.map(block => {
                  const isAnswer = block === answer;
                  return (
                    <Fragment key={block.id}>
                      {showThinking &&
                        hasValidContent(block.message.thinking_content) && (
                          <SeerMarkdown raw={block.message.thinking_content} />
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
