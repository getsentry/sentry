import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {t} from 'sentry/locale';
import {MessagesPanel} from 'sentry/views/explore/conversations/components/messagesPanel';
import type {UseConversationsOptions} from 'sentry/views/explore/conversations/hooks/useConversation';
import {useConversationTranscript} from 'sentry/views/explore/conversations/hooks/useConversationTranscript';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

interface Props {
  conversation: UseConversationsOptions;
  hasNextPage: boolean;
  isLoading: boolean;
  nodes: AITraceSpanNode[];
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeId: string | null;
  onViewTimeline?: () => void;
}

export function ConversationTranscriptPanel({
  conversation,
  hasNextPage,
  isLoading,
  ...panelProps
}: Props) {
  const transcript = useConversationTranscript(conversation);
  const useBackend = transcript.source === 'backend';
  const failed =
    useBackend &&
    (transcript.isError || (transcript.data !== undefined && !transcript.data.complete));

  return (
    <Fragment>
      {transcript.available && (
        <Flex role="group" aria-label={t('Transcript source')} gap="sm" padding="md">
          <Button
            size="sm"
            aria-pressed={useBackend}
            onClick={() => void transcript.setSource('backend')}
          >
            {t('Backend transcript')}
          </Button>
          <Button
            size="sm"
            aria-pressed={!useBackend}
            onClick={() => void transcript.setSource('frontend')}
          >
            {t('Frontend transcript')}
          </Button>
        </Flex>
      )}
      {failed ? (
        <EmptyMessage>
          {t(
            'Could not load the backend transcript. Retry or switch to the frontend transcript.'
          )}
          <Button size="sm" onClick={() => void transcript.refetch()}>
            {t('Retry')}
          </Button>
        </EmptyMessage>
      ) : (
        <MessagesPanel
          {...panelProps}
          isLoading={isLoading || (useBackend && (transcript.isLoading || hasNextPage))}
          messages={useBackend ? (transcript.data?.transcript ?? []) : undefined}
        />
      )}
    </Fragment>
  );
}
