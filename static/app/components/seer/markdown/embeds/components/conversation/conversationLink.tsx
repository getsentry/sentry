import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconChat} from 'sentry/icons';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  CONVERSATIONS_DETAIL_SUB_PATH,
  EXPLORE_AGENTS_SUB_PATH,
} from 'sentry/views/explore/conversations/settings';

export type ConversationData = EmbedOutput<'conversation'>;

/**
 * The detail view scopes its span query to the URL's time range, so the window
 * is padded either side of the conversation's own timestamps -- the same hour
 * `getConversationDetailUrl` pads by for a row in the conversations table.
 */
const CONVERSATION_WINDOW_PADDING_MS = 60 * 60 * 1000;

/**
 * `getConversationDetailUrl` needs a full `Conversation` row, which an embed
 * never has -- the tag carries an id and, at best, the conversation's first and
 * last span timestamps. Build the same path from those instead.
 */
export function getConversationHref(
  data: ConversationData,
  organizationSlug: string,
  referrer = 'seer-conversation-embed'
): string {
  const basePath = `/organizations/${organizationSlug}/explore/${EXPLORE_AGENTS_SUB_PATH}/${CONVERSATIONS_DETAIL_SUB_PATH}/${encodeURIComponent(data.id)}/`;

  const params = new URLSearchParams();
  if (data.start) {
    params.set(
      'start',
      new Date(Date.parse(data.start) - CONVERSATION_WINDOW_PADDING_MS).toISOString()
    );
  }
  if (data.end) {
    params.set(
      'end',
      new Date(Date.parse(data.end) + CONVERSATION_WINDOW_PADDING_MS).toISOString()
    );
  }
  for (const project of data.projects ?? []) {
    params.append('project', String(project));
  }
  params.set('referrer', referrer);

  return normalizeUrl(`${basePath}?${params.toString()}`);
}

interface ConversationLinkProps {
  data: ConversationData;
  /**
   * Overrides the tag's title. The block passes the API-provided title once it
   * has loaded, which is fresher than whatever the model wrote into the tag.
   */
  title?: string | null;
}

export function ConversationLink({data, title}: ConversationLinkProps) {
  const organization = useOrganization();

  return (
    <ResourceLink
      icon={IconChat}
      href={getConversationHref(data, organization.slug)}
      title={title ?? data.title ?? t('Conversation %s', data.id)}
    />
  );
}
