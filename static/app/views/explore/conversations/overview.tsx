import {useEffect, useMemo} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {Flex, Stack} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {
  useSpanSearchQueryBuilderProps,
  type UseSpanSearchQueryBuilderProps,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import type {TagCollection} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SchemaHintsList} from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {
  ExploreBodyContent,
  ExploreBodySearch,
} from 'sentry/views/explore/components/styles';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useSpanItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {ConversationsTable} from 'sentry/views/explore/conversations/components/conversationsTable';
import {useShowConversationOnboarding} from 'sentry/views/explore/conversations/hooks/useShowConversationOnboarding';
import {ConversationOnboarding} from 'sentry/views/explore/conversations/onboarding';
import {MAX_PICKABLE_DAYS} from 'sentry/views/explore/conversations/settings';
import {AgentSelector} from 'sentry/views/insights/common/components/agentSelector';
import {InsightsEnvironmentSelector} from 'sentry/views/insights/common/components/enviornmentSelector';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {useDefaultToAllProjects} from 'sentry/views/insights/common/utils/useDefaultToAllProjects';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';
import {TableUrlParams} from 'sentry/views/insights/pages/agents/utils/urlParams';

const DISABLE_AGGREGATES: never[] = [];

function ConversationsOverviewPage() {
  const organization = useOrganization();
  const datePageFilterProps = useDatePageFilterProps({
    maxPickableDays: MAX_PICKABLE_DAYS,
    maxUpgradableDays: MAX_PICKABLE_DAYS,
  });
  useDefaultToAllProjects();
  const {
    showOnboarding,
    isLoading: isOnboardingLoading,
    refetch: refetchOnboarding,
  } = useShowConversationOnboarding();

  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withOptions({history: 'replace'})
  );
  const {unsetCursor} = useTableCursor();

  useEffect(() => {
    trackAnalytics('conversations.page-view', {
      organization,
    });
  }, [organization]);

  const {attributes: numberTags = [], isLoading: numberTagsLoading} =
    useSpanItemAttributes({}, 'number');
  const {attributes: stringTags = [], isLoading: stringTagsLoading} =
    useSpanItemAttributes({}, 'string');
  const {attributes: booleanTags = [], isLoading: booleanTagsLoading} =
    useSpanItemAttributes({}, 'boolean');

  const hasRawSearchReplacement = organization.features.includes(
    'search-query-builder-raw-search-replacement'
  );

  const searchQueryBuilderProps: UseSpanSearchQueryBuilderProps = useMemo(
    () => ({
      initialQuery: searchQuery ?? '',
      onSearch: (newQuery: string) => {
        setSearchQuery(newQuery);
        unsetCursor();
      },
      searchSource: 'conversations',
      replaceRawSearchKeys: hasRawSearchReplacement ? ['span.name'] : undefined,
      matchKeySuggestions: [
        {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
        {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
      ],
    }),
    [hasRawSearchReplacement, searchQuery, setSearchQuery, unsetCursor]
  );

  const {spanSearchQueryBuilderProviderProps, spanSearchQueryBuilderProps} =
    useSpanSearchQueryBuilderProps(searchQueryBuilderProps);

  return (
    <SearchQueryBuilderProvider {...spanSearchQueryBuilderProviderProps}>
      <ExploreBodySearch>
        <Layout.Main width="full">
          <Stack gap="md">
            <Flex gap="md" align="center" wrap="wrap">
              <Flex gap="md" align="center">
                <PageFilterBar condensed>
                  <InsightsProjectSelector
                    resetParamsOnChange={[TableUrlParams.CURSOR]}
                  />
                  <InsightsEnvironmentSelector
                    resetParamsOnChange={[TableUrlParams.CURSOR]}
                  />
                  <DatePageFilter
                    {...datePageFilterProps}
                    resetParamsOnChange={[TableUrlParams.CURSOR]}
                  />
                </PageFilterBar>
                <AgentSelector
                  storageKeyPrefix="conversations:agent-filter"
                  referrer="api.insights.conversations.get-agent-names"
                />
              </Flex>
              {!showOnboarding && !isOnboardingLoading && (
                <Flex flex={1} minWidth="300px">
                  <TraceItemSearchQueryBuilder {...spanSearchQueryBuilderProps} />
                </Flex>
              )}
            </Flex>
            {!showOnboarding && !isOnboardingLoading && (
              <SchemaHintsList
                supportedAggregates={DISABLE_AGGREGATES}
                booleanTags={booleanTags as TagCollection}
                numberTags={numberTags as TagCollection}
                stringTags={stringTags as TagCollection}
                isLoading={numberTagsLoading || stringTagsLoading || booleanTagsLoading}
                exploreQuery={searchQuery ?? ''}
                source={SchemaHintsSources.CONVERSATIONS}
              />
            )}
          </Stack>
        </Layout.Main>
      </ExploreBodySearch>
      <ExploreBodyContent>
        <Stack flex={1} padding="xl" gap="md">
          {isOnboardingLoading ? (
            <LoadingIndicator />
          ) : showOnboarding ? (
            <ConversationOnboarding onDismiss={refetchOnboarding} />
          ) : (
            <ConversationsTable />
          )}
        </Stack>
      </ExploreBodyContent>
    </SearchQueryBuilderProvider>
  );
}

export default ConversationsOverviewPage;
