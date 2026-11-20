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
        <StepResponses {...transcript} blocks={blocks} />
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
  const partialBlocks = useMemo(() => {
    const lastBlock = blocks.at(-1);
    return defined(lastBlock) && isSeerErrorBlock(lastBlock)
      ? blocks.slice(0, -1)
      : blocks;
  }, [blocks]);
  const transcript = useStepTranscript(partialBlocks);

  if (!transcript.responses.length) {
    return null;
  }

  return (
    <ArtifactDetails>
      <StepResponses {...transcript} blocks={blocks} />
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
  return {responses, latestTodos};
}

/**
 * A step's responses, the way the Seer Agent chat draws them. `blocks` is the
 * step's full list, including the error block left out of `responses`.
 */
function StepResponses({
  blocks,
  responses,
  latestTodos,
}: ReturnType<typeof useStepTranscript> & {blocks: AutofixSection['blocks']}) {
  return responses.map(segment => {
    const lastBlock = segment.blocks.at(-1);
    const nextBlock = defined(lastBlock)
      ? blocks[blocks.indexOf(lastBlock) + 1]
      : undefined;
    return (
      <ResponseGroup
        key={segment.indices[0]}
        group={segment.blocks}
        blockIndex={segment.indices[0]!}
        latestTodos={latestTodos}
        readOnly
        showThinking
        // The timestamp of the user message or Seer's error block that ended the
        // segment. None while the segment is still running.
        endedAt={nextBlock?.timestamp}
      />
    );
  });
}
