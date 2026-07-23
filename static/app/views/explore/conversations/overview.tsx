import {useEffect, useMemo} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {Flex, Stack} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {
  useSpanSearchQueryBuilderProps,
  type UseSpanSearchQueryBuilderProps,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ExploreBodyContent,
  ExploreBodySearch,
} from 'sentry/views/explore/components/styles';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {ConversationsTable} from 'sentry/views/explore/conversations/components/conversationsTable';
import {SaveConversationQueryButton} from 'sentry/views/explore/conversations/components/saveConversationQueryButton';
import {useShowConversationOnboarding} from 'sentry/views/explore/conversations/hooks/useShowConversationOnboarding';
import {ConversationOnboarding} from 'sentry/views/explore/conversations/onboarding';
import {MAX_PICKABLE_DAYS} from 'sentry/views/explore/conversations/settings';
import {AgentSelector} from 'sentry/views/insights/common/components/agentSelector';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';
import {
  FilterUrlParams,
  TableUrlParams,
} from 'sentry/views/insights/pages/agents/utils/urlParams';

function ConversationsOverviewPage() {
  const organization = useOrganization();
  const datePageFilterProps = useDatePageFilterProps({
    maxPickableDays: MAX_PICKABLE_DAYS,
    maxUpgradableDays: MAX_PICKABLE_DAYS,
  });
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

  useEffect(() => {
    if (!isOnboardingLoading) {
      if (showOnboarding) {
        trackAnalytics('conversations.onboarding.page-view', {
          organization,
        });
      } else {
        trackAnalytics('conversations.table.page-view', {
          organization,
        });
      }
    }
  }, [showOnboarding, isOnboardingLoading, organization]);

  const searchQueryBuilderProps: UseSpanSearchQueryBuilderProps = useMemo(
    () => ({
      initialQuery: searchQuery ?? '',
      onSearch: (newQuery, {queryIsValid}) => {
        // The conversations API can't express negation (and other invalid
        // syntax), so don't apply a query the builder has flagged as invalid.
        if (!queryIsValid) {
          return;
        }
        setSearchQuery(newQuery);
        unsetCursor();
      },
      searchSource: 'conversations',
      // The conversations API cannot express negation given how it fetches
      // conversations, so hide negation operators from the search suggestions.
      disallowNegation: true,
      replaceRawSearchKeys: ['gen_ai.conversation.id', 'gen_ai.input.messages'],
      matchKeySuggestions: [
        {key: 'gen_ai.conversation.id', valuePattern: /^[0-9a-fA-F]{8,32}$/},
        {key: 'gen_ai.conversation.id', valuePattern: /^resp_/},
        {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
        {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
      ],
    }),
    [searchQuery, setSearchQuery, unsetCursor]
  );

  const {spanSearchQueryBuilderProviderProps, spanSearchQueryBuilderProps} =
    useSpanSearchQueryBuilderProps(searchQueryBuilderProps);

  return (
    <SearchQueryBuilderProvider {...spanSearchQueryBuilderProviderProps}>
      <ExploreBodySearch>
        <Layout.Main width="full">
          <Stack gap="md">
            <Flex gap="md" align="center" wrap="wrap">
              <Flex gap="md" align="center" wrap="wrap">
                <PageFilterBar condensed>
                  <ProjectPageFilter
                    resetParamsOnChange={[TableUrlParams.CURSOR, FilterUrlParams.AGENT]}
                  />
                  <EnvironmentPageFilter resetParamsOnChange={[TableUrlParams.CURSOR]} />
                  <DatePageFilter
                    {...datePageFilterProps}
                    resetParamsOnChange={[TableUrlParams.CURSOR]}
                  />
                </PageFilterBar>
                <AgentSelector referrer="api.insights.conversations.get-agent-names" />
              </Flex>
              {!showOnboarding && !isOnboardingLoading && (
                <Flex flex={1} minWidth="300px">
                  <TraceItemSearchQueryBuilder
                    {...spanSearchQueryBuilderProps}
                    placeholder={t('Search or paste a conversation ID')}
                  />
                </Flex>
              )}
              {!showOnboarding && !isOnboardingLoading && <SaveConversationQueryButton />}
            </Flex>
          </Stack>
        </Layout.Main>
      </ExploreBodySearch>
      <ExploreBodyContent>
        <Stack flex={1} minWidth="0" padding="xl" gap="md">
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
