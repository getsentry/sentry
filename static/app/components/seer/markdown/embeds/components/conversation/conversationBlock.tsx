import {Text} from '@sentry/scraps/text';

import {QueryEmbedCard} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedCard';
import {IconChat} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useConversation} from 'sentry/views/explore/conversations/hooks/useConversation';

import {getConversationHref, type ConversationData} from './conversationLink';
import {
  ConversationMetricsBar,
  getConversationMetricsFromNodes,
} from './conversationMetrics';

function toTimestampMs(isoTimestamp: string | undefined): number | undefined {
  if (!isoTimestamp) {
    return undefined;
  }
  const parsed = Date.parse(isoTimestamp);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Scopes the fetch to the conversation's own projects rather than the host
 * page's filters, which have nothing to do with the conversation the tag names.
 * The ids come from the model, so anything non-numeric is dropped instead of
 * being sent as `NaN`.
 */
function toProjectIds(projects: ConversationData['projects']): number[] | undefined {
  if (!projects?.length) {
    return undefined;
  }
  const ids = projects.map(Number).filter(id => Number.isFinite(id));
  return ids.length > 0 ? ids : undefined;
}

/**
 * Deliberately shows the conversation's totals and not its transcript: the
 * embed is itself rendered inside an agent conversation, so a nested transcript
 * reads as part of the surrounding answer. The link goes to the full detail
 * view for anyone who wants the messages.
 *
 * The totals are the same fields the `conversationsQuery` embed tables, so one
 * conversation reads the same whether the model named it on its own or it came
 * back in a list.
 */
export default function ConversationBlock({data}: {data: ConversationData}) {
  const organization = useOrganization();
  const {nodes, isLoading, error, title} = useConversation({
    conversationId: data.id,
    projects: toProjectIds(data.projects),
    startTimestamp: toTimestampMs(data.start),
    endTimestamp: toTimestampMs(data.end),
  });

  return (
    <QueryEmbedCard
      href={getConversationHref(data, organization.slug)}
      icon={IconChat}
      linkLabel={t('View Conversation')}
      testId="seer-conversation-embed"
      // Prefer the API's title over whatever the model wrote into the tag.
      title={title ?? data.title ?? t('Conversation %s', data.id)}
    >
      {error ? (
        <Text variant="danger">{t('Unable to load conversation.')}</Text>
      ) : !isLoading && nodes.length === 0 ? (
        <Text variant="muted">{t('No messages in this conversation')}</Text>
      ) : (
        <ConversationMetricsBar
          metrics={getConversationMetricsFromNodes(nodes)}
          isLoading={isLoading}
        />
      )}
    </QueryEmbedCard>
  );
}
