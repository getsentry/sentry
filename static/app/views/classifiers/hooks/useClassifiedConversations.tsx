import {useCallback, useMemo} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

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
const TIMESTAMP_FIELD = 'timestamp';

const CLASSIFIED_CONVERSATION_SORTS = ['age', '-age', 'result', '-result'] as const;

export type ClassifiedConversationSortKey = 'age' | 'result';

export type ClassifiedConversationSort = (typeof CLASSIFIED_CONVERSATION_SORTS)[number];

type ClassifierResultRow = Record<string, string | number | null | undefined>;

export interface ClassifiedConversation {
  classifiedAt: string | null;
  conversation: Conversation;
  result: number | null;
}

export function useClassifiedConversations(classifier: TelemetryClassifier) {
  const organization = useOrganization();
  const {cursor, setCursor, unsetCursor} = useTableCursor();
  const [sort, setSortState] = useQueryState(
    'sort',
    parseAsStringLiteral(CLASSIFIED_CONVERSATION_SORTS)
      .withDefault('-age')
      .withOptions({history: 'replace'})
  );
  const resultField = `tags[${getResultAttributeKey(classifier.resultAttribute)},number]`;
  const project = [Number(classifier.projectId)];

  const sortDirection = sort.startsWith('-') ? '-' : '';
  const sortField = sort.endsWith('result') ? resultField : TIMESTAMP_FIELD;

  const setSort = useCallback(
    (nextSort: ClassifiedConversationSort) => {
      setSortState(nextSort);
      unsetCursor();
    },
    [setSortState, unsetCursor]
  );

  const resultsQuery = useQuery({
    ...apiOptions.as<{data: ClassifierResultRow[]}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: DiscoverDatasets.ENRICHMENT_ATTRIBUTES,
          field: [CONVERSATION_ID_FIELD, resultField, TIMESTAMP_FIELD],
          query: `has:${resultField}`,
          sort: `${sortDirection}${sortField}`,
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

  const classifications = useMemo(() => {
    const classificationsByConversationId = new Map<
      string,
      Pick<ClassifiedConversation, 'classifiedAt' | 'result'>
    >();
    for (const row of resultsQuery.data?.json.data ?? []) {
      const conversationId = row[CONVERSATION_ID_FIELD];
      if (typeof conversationId !== 'string' || !conversationId) {
        continue;
      }
      if (!classificationsByConversationId.has(conversationId)) {
        const result = row[resultField];
        const timestamp = row[TIMESTAMP_FIELD];
        classificationsByConversationId.set(conversationId, {
          result: typeof result === 'number' ? result : null,
          classifiedAt: typeof timestamp === 'string' ? timestamp : null,
        });
      }
    }
    return classificationsByConversationId;
  }, [resultsQuery.data, resultField]);

  const conversationIds = [...classifications.keys()];

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

  const data = useMemo<ClassifiedConversation[]>(() => {
    const conversationsById = new Map(
      (conversationsQuery.data ?? []).map(conversation => [
        conversation.conversationId,
        conversation,
      ])
    );
    return [...classifications].flatMap(([conversationId, classification]) => {
      const conversation = conversationsById.get(conversationId);
      return conversation ? [{...classification, conversation}] : [];
    });
  }, [conversationsQuery.data, classifications]);

  return {
    data,
    isFetching: resultsQuery.isFetching || conversationsQuery.isFetching,
    error: resultsQuery.error ?? conversationsQuery.error,
    pageLinks: resultsQuery.data?.headers.Link,
    setCursor,
    sort,
    setSort,
  };
}
