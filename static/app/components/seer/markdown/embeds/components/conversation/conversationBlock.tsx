import {useState} from 'react';

import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  ConversationLink,
  type ConversationData,
} from 'sentry/components/seer/markdown/embeds/components/conversation/conversationLink';
import {QueryEmbedCard} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedCard';
import {t} from 'sentry/locale';
import {ConversationAggregatesBar} from 'sentry/views/explore/conversations/components/conversationSummary';
import {
  MessagesPanel,
  MessagesPanelSkeleton,
} from 'sentry/views/explore/conversations/components/messagesPanel';
import {useConversation} from 'sentry/views/explore/conversations/hooks/useConversation';

/** Keeps a long transcript from pushing the rest of the answer off screen. */
const TRANSCRIPT_MAX_HEIGHT = '400px';

function toTimestampMs(isoTimestamp: string | undefined): number | undefined {
  if (!isoTimestamp) {
    return undefined;
  }
  const parsed = Date.parse(isoTimestamp);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export default function ConversationBlock({data}: {data: ConversationData}) {
  // Selection lives here rather than in the URL: an embed must not be able to
  // change the host page's shareable state (see the embeds README).
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const {nodes, isLoading, error, title} = useConversation({
    conversationId: data.id,
    startTimestamp: toTimestampMs(data.start),
    endTimestamp: toTimestampMs(data.end),
  });

  return (
    <QueryEmbedCard
      link={<ConversationLink data={data} title={title ?? data.title} />}
      testId="seer-conversation-embed"
    >
      <Stack gap="md">
        <ConversationAggregatesBar
          conversationId={data.id}
          nodes={nodes}
          isLoading={isLoading}
        />
        {isLoading ? (
          <MessagesPanelSkeleton />
        ) : error ? (
          <Text variant="danger">{t('Unable to load conversation.')}</Text>
        ) : nodes.length === 0 ? (
          <Text variant="muted">{t('No messages in this conversation')}</Text>
        ) : (
          <Container
            border="primary"
            radius="md"
            maxHeight={TRANSCRIPT_MAX_HEIGHT}
            overflowY="auto"
          >
            <MessagesPanel
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={node => setSelectedNodeId(node.id)}
            />
          </Container>
        )}
      </Stack>
    </QueryEmbedCard>
  );
}
