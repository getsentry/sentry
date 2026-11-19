import {useMemo, useState} from 'react';

import {MessageRow, ThinkingBlock} from '@sentry/scraps/chat';

import {type AutofixSection} from 'sentry/components/events/autofix/useExplorerAutofix';
import {defined} from 'sentry/utils/defined';
import {
  groupTranscript,
  ResponseGroup,
} from 'sentry/views/seerExplorer/components/chat/responseGroup';
import {findLatestTodos} from 'sentry/views/seerExplorer/components/chat/toolUse';
import {isSeerErrorBlock} from 'sentry/views/seerExplorer/types';

import {ArtifactDetails} from './artifactDetails';

interface ArtifactLoadingDetailsProps {
  blocks: AutofixSection['blocks'];
  loadingMessage: string;
}

export function ArtifactLoadingDetails({
  loadingMessage,
  blocks,
}: ArtifactLoadingDetailsProps) {
  const [appearedAt] = useState(() => new Date());
  const transcript = useStepTranscript(blocks);

  return (
    <ArtifactDetails>
      {transcript.responses.length ? (
        <StepResponses {...transcript} />
      ) : (
        <MessageRow from="assistant" density="compact">
          <ThinkingBlock title={loadingMessage} startTime={appearedAt} />
        </MessageRow>
      )}
    </ArtifactDetails>
  );
}

/**
 * What a step wrote before it stopped, drawn as it was while the step ran.
 * Seer's own error block is left out, since the caller explains why the step
 * stopped.
 */
export function ArtifactPartialDetails({blocks}: {blocks: AutofixSection['blocks']}) {
  const partialBlocks = useMemo(
    () => blocks.filter(block => !isSeerErrorBlock(block)),
    [blocks]
  );
  const transcript = useStepTranscript(partialBlocks);

  if (!transcript.responses.length) {
    return null;
  }

  // Seer adds its error block, filtered out above, as the last block when a run
  // fails. Keep its timestamp so the timer ends when the run did.
  const stoppedAt = blocks[blocks.length - 1]?.timestamp;

  return (
    <ArtifactDetails>
      <StepResponses {...transcript} stoppedAt={stoppedAt} />
    </ArtifactDetails>
  );
}

function useStepTranscript(blocks: AutofixSection['blocks']) {
  const responses = useMemo(
    () =>
      groupTranscript(blocks).flatMap(segment =>
        segment.kind === 'response' ? [segment] : []
      ),
    [blocks]
  );
  const latestTodos = useMemo(() => findLatestTodos(blocks), [blocks]);
  return {blocks, responses, latestTodos};
}

/**
 * A step's responses, the way the Seer Agent chat draws them.
 */
function StepResponses({
  blocks,
  responses,
  latestTodos,
  stoppedAt,
}: ReturnType<typeof useStepTranscript> & {stoppedAt?: string}) {
  return responses.map(segment => {
    const lastIndex = segment.indices.at(-1);
    const nextBlock = defined(lastIndex) ? blocks[lastIndex + 1] : undefined;
    return (
      <ResponseGroup
        key={segment.indices[0]}
        group={segment.blocks}
        blockIndex={segment.indices[0]!}
        latestTodos={latestTodos}
        readOnly
        showThinking
        // The timestamp of the user message that ended the segment or, when nothing
        // follows it, of Seer's error block.
        endedAt={nextBlock?.timestamp ?? stoppedAt}
      />
    );
  });
}
