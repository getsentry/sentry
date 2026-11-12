import {Fragment, type ReactNode, useCallback, useEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import {parseAsString, parseAsStringLiteral, useQueryState} from 'nuqs';

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
import type {ConversationsEventParameters} from 'sentry/utils/analytics/conversationsAnalyticsEvents';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {
  ExploreBodyContent,
  ExploreBodySearch,
} from 'sentry/views/explore/components/styles';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useVisitQuery} from 'sentry/views/explore/hooks/useVisitQuery';
import {AgentSelector} from 'sentry/views/insights/common/components/agentSelector';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';
import {getAiInstrumentationDocsLink} from 'sentry/views/insights/pages/agents/utils/docsLinks';
import {
  FilterUrlParams,
  TableUrlParams,
} from 'sentry/views/insights/pages/agents/utils/urlParams';

import {AgentsCharts} from './components/agentsCharts';
import {AgentsChartIntervalSelector} from './components/agentsChartsControls';
import {
  AGENTS_TABLE_TABS,
  AgentsTable,
  type AgentsTableTab,
} from './components/agentsTable';
import {ConversationMissingMessagesAlert} from './components/conversationMissingMessagesAlert';
import {ErrorsOnlyToggle} from './components/errorsOnlyToggle';
import {SaveConversationQueryButton} from './components/saveConversationQueryButton';
import {useConversationDirectHitRedirect} from './hooks/useConversationDirectHitRedirect';
import {useConversations, type Conversation} from './hooks/useConversations';
import {useShowConversationOnboarding} from './hooks/useShowConversationOnboarding';
import {
  CONVERSATION_SEARCH_PLACEHOLDER,
  CONVERSATION_SEARCH_QUERY_BUILDER_PROPS,
  withConversationFields,
} from './utils/conversationSearch';
import {Referrer} from './utils/referrers';
import {MAX_PICKABLE_DAYS} from './settings';

const SPANS_CURSOR_URL_PARAM = 'cursor';
const agentsTableTabParser = parseAsStringLiteral(AGENTS_TABLE_TABS);

/**
 * Links to the listed conversations' platform docs when they all come from one
 * project, and to the general setup docs otherwise.
 */
function MissingMessagesAlert({conversations}: {conversations: Conversation[]}) {
  const {projects} = useProjects();
  const projectIds = new Set(conversations.map(conversation => conversation.projectId));
  const [projectId] = projectIds;
  const platform =
    projectIds.size === 1 && projectId !== null && projectId !== undefined
      ? projects.find(project => project.id === String(projectId))?.platform
      : undefined;

  return (
    <ConversationMissingMessagesAlert
      dismissKey="conversation-missing-messages-alert"
      docsLink={getAiInstrumentationDocsLink(platform)}
      padding="0 0 xl"
      plural
    />
  );
}

function ConversationsOverviewPage() {
  const theme = useTheme();
  const organization = useOrganization();
  const datePageFilterProps = useDatePageFilterProps({
    maxPickableDays: MAX_PICKABLE_DAYS,
    maxUpgradableDays: MAX_PICKABLE_DAYS,
  });
  const {
    hasAgenticSpans,
    hasConversations,
    showOnboarding,
    isLoading: isOnboardingLoading,
    isError: isOnboardingError,
    refetch: refetchOnboarding,
  } = useShowConversationOnboarding();
  const [selectedTab, setSelectedTab] = useQueryState(
    'table',
    agentsTableTabParser.withOptions({history: 'replace'})
  );
  const activeTab: AgentsTableTab =
    selectedTab ?? (hasConversations ? 'conversations' : 'traces');
  const isConversationsTab = activeTab === 'conversations';
  const conversationsResult = useConversations({enabled: isConversationsTab});
  const {
    data: conversations,
    isFetching: isConversationsFetching,
    error: conversationsError,
  } = conversationsResult;
  useConversationDirectHitRedirect({
    isDirectHit: isConversationsTab && conversationsResult.isDirectHit,
    conversations,
  });
  const showMissingMessagesAlert =
    isConversationsTab &&
    !isConversationsFetching &&
    !conversationsError &&
    conversations.length > 0 &&
    conversations.every(
      conversation => !conversation.firstInput && !conversation.lastOutput
    );

  const searchPlaceholder =
    activeTab === 'conversations'
      ? CONVERSATION_SEARCH_PLACEHOLDER
      : activeTab === 'traces'
        ? t('Search by trace ID, operation, service, or user')
        : t('Search by model, provider, tokens, or operation');
  const selectedTabShowsOnboarding =
    !isOnboardingError && (isConversationsTab ? !hasConversations : !hasAgenticSpans);

  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withOptions({history: 'replace'})
  );
  const [, setSpansCursor] = useQueryState(
    SPANS_CURSOR_URL_PARAM,
    parseAsString.withOptions({history: 'replace'})
  );

  const [pageId] = useQueryState('id', parseAsString.withOptions({history: 'replace'}));
  useVisitQuery(pageId ?? undefined);

  const {unsetCursor} = useTableCursor();

  const handleTabChange = useCallback(
    (tab: AgentsTableTab) => {
      setSelectedTab(tab);
      unsetCursor();
      setSpansCursor(null);
    },
    [setSelectedTab, setSpansCursor, unsetCursor]
  );

  useEffect(() => {
    trackAnalytics('conversations.page-view', {
      organization,
    });
  }, [organization]);

  // Without agentic spans, onboarding replaces every tab, so it is tracked
  // regardless of which tab is selected.
  let onboardingEmptyState:
    | ConversationsEventParameters['conversations.onboarding.page-view']['empty_state']
    | null = null;
  if (showOnboarding && !hasAgenticSpans) {
    onboardingEmptyState = 'no_agent_spans';
  } else if (showOnboarding && isConversationsTab) {
    onboardingEmptyState = 'no_conversations';
  }

  useEffect(() => {
    if (isOnboardingLoading) {
      return;
    }
    if (onboardingEmptyState) {
      trackAnalytics('conversations.onboarding.page-view', {
        organization,
        empty_state: onboardingEmptyState,
      });
    } else {
      trackAnalytics('conversations.table.page-view', {
        organization,
        tab: activeTab,
      });
    }
  }, [activeTab, onboardingEmptyState, isOnboardingLoading, organization]);

  const searchQueryBuilderProps: UseSpanSearchQueryBuilderProps = useMemo(
    () => ({
      initialQuery: searchQuery ?? '',
      onSearch: (newQuery, {queryIsValid}) => {
        if (!queryIsValid) {
          return;
        }
        setSearchQuery(newQuery);
        unsetCursor();
        setSpansCursor(null);
      },
      searchSource: isConversationsTab ? 'conversations' : 'agents',
      ...(isConversationsTab ? CONVERSATION_SEARCH_QUERY_BUILDER_PROPS : {}),
    }),
    [isConversationsTab, searchQuery, setSearchQuery, setSpansCursor, unsetCursor]
  );

  const {spanSearchQueryBuilderProviderProps, spanSearchQueryBuilderProps} =
    useSpanSearchQueryBuilderProps(searchQueryBuilderProps);

  const searchQueryBuilderProviderProps = useMemo(
    () =>
      isConversationsTab
        ? withConversationFields(spanSearchQueryBuilderProviderProps)
        : spanSearchQueryBuilderProviderProps,
    [isConversationsTab, spanSearchQueryBuilderProviderProps]
  );

  const resetParamsOnFilterChange = [TableUrlParams.CURSOR, SPANS_CURSOR_URL_PARAM];
  const showSearch = !isOnboardingLoading && !selectedTabShowsOnboarding;
  const tableSearchBar = showSearch ? (
    <Flex gap="md" width="100%" align="center">
      <Flex flex={1} minWidth="0">
        <TraceItemSearchQueryBuilder {...spanSearchQueryBuilderProps} />
      </Flex>
      {isConversationsTab && <ErrorsOnlyToggle />}
      {isConversationsTab && <SaveConversationQueryButton />}
    </Flex>
  ) : null;

  let content: ReactNode;
  if (isOnboardingLoading) {
    content = <LoadingIndicator />;
  } else {
    content = (
      <Fragment>
        {hasAgenticSpans && <AgentsCharts />}
        {showMissingMessagesAlert && (
          <MissingMessagesAlert conversations={conversations} />
        )}
        <AgentsTable
          activeTab={activeTab}
          conversations={conversationsResult}
          hasAgenticSpans={hasAgenticSpans || isOnboardingError}
          hasConversations={hasConversations || isOnboardingError}
          onConversationOnboardingDismiss={refetchOnboarding}
          onTabChange={handleTabChange}
          searchBar={tableSearchBar}
        />
      </Fragment>
    );
  }

  return (
    <SearchQueryBuilderProvider
      {...searchQueryBuilderProviderProps}
      placeholder={searchPlaceholder}
    >
      <ExploreBodySearch
        style={{zIndex: selectedTabShowsOnboarding ? theme.zIndex.header : undefined}}
      >
        <Layout.Main width="full">
          <Stack gap="md">
            <Flex gap="md" align="center" wrap="wrap">
              <Flex gap="md" align="center" wrap="wrap">
                <PageFilterBar condensed>
                  <ProjectPageFilter
                    resetParamsOnChange={[
                      ...resetParamsOnFilterChange,
                      FilterUrlParams.AGENT,
                    ]}
                  />
                  <EnvironmentPageFilter
                    resetParamsOnChange={resetParamsOnFilterChange}
                  />
                  <DatePageFilter
                    {...datePageFilterProps}
                    resetParamsOnChange={resetParamsOnFilterChange}
                  />
                </PageFilterBar>
                <AgentSelector referrer={Referrer.AGENT_NAMES} />
              </Flex>
              {hasAgenticSpans && (
                <Flex flex={1} justify="end">
                  <AgentsChartIntervalSelector />
                </Flex>
              )}
            </Flex>
          </Stack>
        </Layout.Main>
      </ExploreBodySearch>
      <ExploreBodyContent>
        <Stack flex={1} minWidth="0" padding="xl" gap="md">
          {content}
        </Stack>
      </ExploreBodyContent>
    </SearchQueryBuilderProvider>
  );
}

export default ConversationsOverviewPage;
