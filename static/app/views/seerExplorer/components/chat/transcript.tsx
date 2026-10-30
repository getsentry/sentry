import {memo, useMemo} from 'react';

import {BlockComponent} from 'sentry/views/seerExplorer/components/chat';
import {
  groupTranscript,
  ResponseGroup,
} from 'sentry/views/seerExplorer/components/chat/responseGroup';
import {findLatestTodos} from 'sentry/views/seerExplorer/components/chat/toolUse';
import type {
  Block,
  PendingUserInput,
  SeerExplorerRunId,
} from 'sentry/views/seerExplorer/types';

interface SeerExplorerTranscriptProps {
  blocks: Block[];
  getPageReferrer?: () => string;
  interactionPending?: boolean;
  pendingInput?: PendingUserInput | null;
  readOnly?: boolean;
  runId?: SeerExplorerRunId | null;
  showThinking?: boolean;
}

/**
 * The conversation itself. Memoized so typing in the composer (whose state lives in the parent)
 * doesn't re-render every message, and `ResponseGroup`/`BlockComponent` are memoized so a poll only
 * re-renders the segments whose blocks actually changed.
 */
export const SeerExplorerTranscript = memo(function SeerExplorerTranscript({
  blocks,
  getPageReferrer,
  interactionPending,
  pendingInput,
  readOnly,
  runId,
  showThinking,
}: SeerExplorerTranscriptProps) {
  const segments = useMemo(() => groupTranscript(blocks), [blocks]);
  // Walk the conversation once here rather than once per tool block.
  const latestTodos = useMemo(() => findLatestTodos(blocks), [blocks]);

  return segments.map(segment => {
    if (segment.kind === 'user') {
      // For slide-in animation that runs on mount. Avoid running this twice on user
      // blocks when blocks are hydrated.
      return (
        <BlockComponent
          key={`user-${segment.index}`}
          block={segment.block}
          blockIndex={segment.index}
          runId={runId ?? undefined}
        />
      );
    }

    return (
      <ResponseGroup
        key={`response-${segment.indices[0]}`}
        group={segment.blocks}
        blockIndex={segment.indices[0]!}
        latestTodos={latestTodos}
        runId={runId ?? undefined}
        getPageReferrer={getPageReferrer}
        interactionPending={interactionPending}
        pendingInput={pendingInput}
        readOnly={readOnly}
        showThinking={showThinking}
      />
    );
  });
});
