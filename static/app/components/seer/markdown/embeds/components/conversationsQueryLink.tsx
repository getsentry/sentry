import queryString from 'query-string';

import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconChat} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {EXPLORE_AGENTS_SUB_PATH} from 'sentry/views/explore/conversations/settings';
import {getAgentNamesFilter} from 'sentry/views/insights/pages/agents/utils/query';

export type ConversationsQueryData = EmbedOutput<'conversationsQuery'>;

/**
 * The agents list keeps the agent filter in its own `agent` param and folds it
 * into the span query itself only when it calls the API -- see
 * `useCombinedQuery`. Mirror both halves so the link and the block preview
 * below it are filtered the same way.
 */
export function combineAgentQuery(query: string, agents?: string[]): string {
  const agentQuery = getAgentNamesFilter(agents ?? []);
  if (!agentQuery) {
    return query;
  }
  if (!query) {
    return agentQuery;
  }
  return `(${agentQuery}) and (${query})`;
}

export function getConversationsQueryHref(
  data: ConversationsQueryData,
  organization: Organization
): string {
  const {query, agents, projects, environments, statsPeriod, start, end} = data;

  return queryString.stringifyUrl({
    url: normalizeUrl(
      `/organizations/${organization.slug}/explore/${EXPLORE_AGENTS_SUB_PATH}/`
    ),
    query: {
      query,
      project: projects,
      environment: environments,
      statsPeriod,
      start,
      end,
      // The list reads `agent` as a single comma-separated value, not repeated
      // params.
      agent: agents?.length ? agents.join(',') : undefined,
      referrer: 'seer-conversations-query-embed',
    },
  });
}

/**
 * The name the model gave the query, or a description of what it searches. The
 * block renders this as its heading, so both levels name the query the same way.
 */
export function getConversationsQueryTitle(data: ConversationsQueryData): string {
  return data.title ?? t('Conversation search');
}

export function ConversationsQueryLink({data}: {data: ConversationsQueryData}) {
  const organization = useOrganization();

  return (
    <ResourceLink
      icon={IconChat}
      href={getConversationsQueryHref(data, organization)}
      title={getConversationsQueryTitle(data)}
    />
  );
}
