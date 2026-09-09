import {Text} from '@sentry/scraps/text';

import {QueryEmbedCard} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedCard';
import {t} from 'sentry/locale';
import {ConversationAggregatesBar} from 'sentry/views/explore/conversations/components/conversationSummary';
import {useConversation} from 'sentry/views/explore/conversations/hooks/useConversation';

import {ConversationLink, type ConversationData} from './conversationLink';

function toTimestampMs(isoTimestamp: string | undefined): number | undefined {
  if (!isoTimestamp) {
    return undefined;
  }
  const parsed = Date.parse(isoTimestamp);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Deliberately shows the conversation's totals and not its transcript: the
 * embed is itself rendered inside an agent conversation, so a nested transcript
 * reads as part of the surrounding answer. The link goes to the full detail
 * view for anyone who wants the messages.
 */
export default function ConversationBlock({data}: {data: ConversationData}) {
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
      {error ? (
        <Text variant="danger">{t('Unable to load conversation.')}</Text>
      ) : !isLoading && nodes.length === 0 ? (
        <Text variant="muted">{t('No messages in this conversation')}</Text>
      ) : (
        <ConversationAggregatesBar
          conversationId={data.id}
          nodes={nodes}
          isLoading={isLoading}
        />
      )}
    </QueryEmbedCard>
  );
}
