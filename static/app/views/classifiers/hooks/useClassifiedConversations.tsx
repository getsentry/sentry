import {useMemo} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';
import {
  CLASSIFIER_DETAIL_STATS_PERIOD,
  getResultAttributeKey,
} from 'sentry/views/classifiers/utils';
import type {Conversation} from 'sentry/views/explore/conversations/hooks/useConversations';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';

const CLASSIFIED_CONVERSATIONS_PER_PAGE = 20;

const CONVERSATION_ID_FIELD = 'gen_ai.conversation.id';

type ClassifierResultRow = Record<string, string | number | null | undefined>;

export function useClassifiedConversations(classifier: TelemetryClassifier) {
  const organization = useOrganization();
  const {cursor, setCursor, unsetCursor} = useTableCursor();
  const resultField = `tags[${getResultAttributeKey(classifier.resultAttribute)},number]`;
  const project = [Number(classifier.projectId)];

  const resultsQuery = useQuery({
    ...apiOptions.as<{data: ClassifierResultRow[]}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: DiscoverDatasets.ENRICHMENT_ATTRIBUTES,
          field: [CONVERSATION_ID_FIELD, resultField, 'timestamp'],
          query: `has:${resultField}`,
          sort: '-timestamp',
          per_page: CLASSIFIED_CONVERSATIONS_PER_PAGE,
          cursor,
          project,
          statsPeriod: CLASSIFIER_DETAIL_STATS_PERIOD,
          referrer: 'api.classifiers.detail.conversations',
        },
        staleTime: 60_000,
      }
    ),
    select: selectJsonWithHeaders,
  });

  const results = useMemo(() => {
    const resultsByConversationId = new Map<string, number | null>();
    for (const row of resultsQuery.data?.json.data ?? []) {
      const conversationId = row[CONVERSATION_ID_FIELD];
      if (typeof conversationId !== 'string' || !conversationId) {
        continue;
      }
      if (!resultsByConversationId.has(conversationId)) {
        const value = row[resultField];
        resultsByConversationId.set(
          conversationId,
          typeof value === 'number' ? value : null
        );
      }
    }
    return resultsByConversationId;
  }, [resultsQuery.data, resultField]);

  const conversationIds = [...results.keys()];

  const conversationsQuery = useQuery(
    apiOptions.as<Conversation[]>()(
      '/organizations/$organizationIdOrSlug/agents/conversations/',
      {
        path:
          conversationIds.length > 0
            ? {organizationIdOrSlug: organization.slug}
            : skipToken,
        query: {
          query: new MutableSearch('')
            .addFilterValueList(CONVERSATION_ID_FIELD, conversationIds)
            .formatString(),
          project,
          per_page: conversationIds.length,
          statsPeriod: CLASSIFIER_DETAIL_STATS_PERIOD,
        },
        staleTime: 60_000,
      }
    )
  );

  const data = useMemo(() => {
    const conversationsById = new Map(
      (conversationsQuery.data ?? []).map(conversation => [
        conversation.conversationId,
        conversation,
      ])
    );
    return [...results.keys()].flatMap(
      conversationId => conversationsById.get(conversationId) ?? []
    );
  }, [conversationsQuery.data, results]);

  return {
    data,
    results,
    isFetching: resultsQuery.isFetching || conversationsQuery.isFetching,
    error: resultsQuery.error ?? conversationsQuery.error,
    pageLinks: resultsQuery.data?.headers.Link,
    setCursor,
    unsetCursor,
  };
}
