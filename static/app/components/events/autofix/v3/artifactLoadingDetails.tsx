import {useMemo, useState} from 'react';

import {MessageRow, ThinkingBlock} from '@sentry/scraps/chat';

import {type AutofixSection} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  groupTranscript,
  ResponseGroup,
} from 'sentry/views/seerExplorer/components/chat/responseGroup';
import {findLatestTodos} from 'sentry/views/seerExplorer/components/chat/toolUse';

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
  const responses = useMemo(
    () =>
      groupTranscript(blocks).flatMap(segment =>
        segment.kind === 'response' ? [segment] : []
      ),
    [blocks]
  );
  const latestTodos = useMemo(() => findLatestTodos(blocks), [blocks]);

  return (
    <ArtifactDetails>
      {responses.length ? (
        responses.map(segment => (
          <ResponseGroup
            key={segment.indices[0]}
            group={segment.blocks}
            blockIndex={segment.indices[0]!}
            latestTodos={latestTodos}
            readOnly
            showThinking
          />
        ))
      ) : (
        <MessageRow from="assistant" density="compact">
          <ThinkingBlock title={loadingMessage} startTime={appearedAt} />
        </MessageRow>
      )}
    </ArtifactDetails>
  );
}
