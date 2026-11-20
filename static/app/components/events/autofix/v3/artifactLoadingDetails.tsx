import {useMemo, useState} from 'react';

import {MessageRow, ThinkingBlock} from '@sentry/scraps/chat';

import {type AutofixSection} from 'sentry/components/events/autofix/useExplorerAutofix';
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

  return (
    <ArtifactDetails>
      <StepResponses {...transcript} />
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
 * A step's responses, the way the Seer Agent chat draws them.
 */
function StepResponses({responses, latestTodos}: ReturnType<typeof useStepTranscript>) {
  return responses.map(segment => (
    <ResponseGroup
      key={segment.indices[0]}
      group={segment.blocks}
      blockIndex={segment.indices[0]!}
      latestTodos={latestTodos}
      readOnly
      showThinking
    />
  ));
}
