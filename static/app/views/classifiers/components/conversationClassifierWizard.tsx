import {Fragment, useMemo, useState} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {
  useSpanSearchQueryBuilderProps,
  type UseSpanSearchQueryBuilderProps,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {
  CLASSIFIER_PREVIEW_PER_PAGE,
  getEnvironmentsFilter,
} from 'sentry/views/classifiers/utils';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {ConversationsTable} from 'sentry/views/explore/conversations/components/conversationsTable';
import {useConversations} from 'sentry/views/explore/conversations/hooks/useConversations';
import {
  CONVERSATION_SEARCH_PLACEHOLDER,
  CONVERSATION_SEARCH_QUERY_BUILDER_PROPS,
  withConversationFields,
} from 'sentry/views/explore/conversations/utils/conversationSearch';
import {Referrer} from 'sentry/views/explore/conversations/utils/referrers';
import {AgentSelector} from 'sentry/views/insights/common/components/agentSelector';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {FilterUrlParams} from 'sentry/views/insights/pages/agents/utils/urlParams';

import {ClassifierWizard} from './classifierWizard';

const RESET_PARAMS_ON_PROJECT_CHANGE = [FilterUrlParams.AGENT];

function ConversationFilters() {
  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withOptions({history: 'replace'})
  );

  const searchQueryBuilderProps: UseSpanSearchQueryBuilderProps = useMemo(
    () => ({
      ...CONVERSATION_SEARCH_QUERY_BUILDER_PROPS,
      initialQuery: searchQuery ?? '',
      onSearch: (newQuery, {queryIsValid}) => {
        if (queryIsValid) {
          setSearchQuery(newQuery);
        }
      },
      searchSource: 'classifiers',
    }),
    [searchQuery, setSearchQuery]
  );

  const {spanSearchQueryBuilderProviderProps, spanSearchQueryBuilderProps} =
    useSpanSearchQueryBuilderProps(searchQueryBuilderProps);

  const providerProps = useMemo(
    () => withConversationFields(spanSearchQueryBuilderProviderProps),
    [spanSearchQueryBuilderProviderProps]
  );

  return (
    <Fragment>
      <AgentSelector referrer={Referrer.AGENT_NAMES} />
      <SearchQueryBuilderProvider
        {...providerProps}
        placeholder={CONVERSATION_SEARCH_PLACEHOLDER}
      >
        <Flex flex={1} minWidth="300px">
          <TraceItemSearchQueryBuilder {...spanSearchQueryBuilderProps} />
        </Flex>
      </SearchQueryBuilderProvider>
    </Fragment>
  );
}

function ConversationPreview({
  conversations,
}: {
  conversations: ReturnType<typeof useConversations>;
}) {
  return (
    <Stack gap="md">
      <Stack gap="2xs">
        <Heading as="h2" size="lg">
          {t('Matched conversations')}
        </Heading>
        <Text variant="muted">
          {t(
            'Up to %s conversations from the last 7 days that match these filters',
            CLASSIFIER_PREVIEW_PER_PAGE
          )}
        </Text>
      </Stack>
      <ConversationsTable conversations={conversations} hidePagination />
    </Stack>
  );
}

export function ConversationClassifierWizard() {
  const {selection} = usePageFilters();
  const filterQuery = useCombinedQuery(getEnvironmentsFilter(selection.environments));
  const [isPreviewing, setIsPreviewing] = useState(false);
  const conversations = useConversations({
    enabled: isPreviewing,
    perPage: CLASSIFIER_PREVIEW_PER_PAGE,
  });

  return (
    <ClassifierWizard
      dataset="conversation"
      filterQuery={filterQuery}
      filters={<ConversationFilters />}
      isPreviewing={isPreviewing}
      preview={<ConversationPreview conversations={conversations} />}
      resetParamsOnProjectChange={RESET_PARAMS_ON_PROJECT_CHANGE}
      onPreview={() => (isPreviewing ? conversations.refetch() : setIsPreviewing(true))}
    />
  );
}
