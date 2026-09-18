import {Fragment, type ReactNode, useCallback, useEffect, useMemo} from 'react';
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
import type {GetTagValues} from 'sentry/components/searchQueryBuilder';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {FieldKind, type FieldDefinition} from 'sentry/utils/fields';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ExploreBodyContent,
  ExploreBodySearch,
} from 'sentry/views/explore/components/styles';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {AgentsCharts} from 'sentry/views/explore/conversations/components/agentsCharts';
import {
  AGENTS_TABLE_TABS,
  AgentsTable,
  type AgentsTableTab,
} from 'sentry/views/explore/conversations/components/agentsTable';
import {ConversationMissingMessagesAlert} from 'sentry/views/explore/conversations/components/conversationMissingMessagesAlert';
import {ConversationsChart} from 'sentry/views/explore/conversations/components/conversationsChart';
import {ConversationsTable} from 'sentry/views/explore/conversations/components/conversationsTable';
import {SaveConversationQueryButton} from 'sentry/views/explore/conversations/components/saveConversationQueryButton';
import {
  CONVERSATION_FIELDS,
  useConversations,
} from 'sentry/views/explore/conversations/hooks/useConversations';
import {useShowConversationOnboarding} from 'sentry/views/explore/conversations/hooks/useShowConversationOnboarding';
import {ConversationOnboarding} from 'sentry/views/explore/conversations/onboarding';
import {MAX_PICKABLE_DAYS} from 'sentry/views/explore/conversations/settings';
import {Referrer} from 'sentry/views/explore/conversations/utils/referrers';
import {AgentSelector} from 'sentry/views/insights/common/components/agentSelector';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';
import {
  FilterUrlParams,
  TableUrlParams,
} from 'sentry/views/insights/pages/agents/utils/urlParams';

const CONVERSATION_FIELD_DEFINITIONS: Record<string, FieldDefinition> =
  Object.fromEntries(
    Object.values(CONVERSATION_FIELDS).map(({key, valueType, description}) => [
      key,
      {kind: FieldKind.FIELD, valueType, desc: description},
    ])
  );

const CONVERSATION_FILTER_KEYS: TagCollection = Object.fromEntries(
  Object.values(CONVERSATION_FIELDS).map(({key}) => [
    key,
    {key, name: key, kind: FieldKind.MEASUREMENT},
  ])
);

const SPANS_CURSOR_URL_PARAM = 'cursor';
const agentsTableTabParser = parseAsStringLiteral(AGENTS_TABLE_TABS);

function ConversationsOverviewPage() {
  const organization = useOrganization();
  const agentsOverviewEnabled = organization.features.includes('gen-ai-agents-overview');
  const datePageFilterProps = useDatePageFilterProps({
    maxPickableDays: MAX_PICKABLE_DAYS,
    maxUpgradableDays: MAX_PICKABLE_DAYS,
  });
  const {
    hasAgenticSpans,
    hasConversations,
    showOnboarding,
    isLoading: isOnboardingLoading,
    refetch: refetchOnboarding,
  } = useShowConversationOnboarding();
  const {
    data: conversations,
    isFetching: isConversationsFetching,
    error: conversationsError,
  } = useConversations();
  const showMissingMessagesAlert =
    !isConversationsFetching &&
    !conversationsError &&
    conversations.length > 0 &&
    conversations.every(
      conversation => !conversation.firstInput && !conversation.lastOutput
    );

  const [selectedTab, setSelectedTab] = useQueryState(
    'table',
    agentsTableTabParser.withOptions({history: 'replace'})
  );
  const activeTab: AgentsTableTab = agentsOverviewEnabled
    ? (selectedTab ?? (hasConversations ? 'conversations' : 'traces'))
    : 'conversations';
  const isConversationsTab = activeTab === 'conversations';
  const selectedTabShowsOnboarding = isConversationsTab
    ? !hasConversations
    : !hasAgenticSpans;

  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withOptions({history: 'replace'})
  );
  const [, setSpansCursor] = useQueryState(
    SPANS_CURSOR_URL_PARAM,
    parseAsString.withOptions({history: 'replace'})
  );
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
    trackAnalytics('conversations.page-view', {organization});
  }, [organization]);

  useEffect(() => {
    if (isOnboardingLoading || !isConversationsTab) {
      return;
    }
    if (showOnboarding) {
      trackAnalytics('conversations.onboarding.page-view', {organization});
    } else {
      trackAnalytics('conversations.table.page-view', {organization});
    }
  }, [isConversationsTab, showOnboarding, isOnboardingLoading, organization]);

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
      disableRecentSearches: isConversationsTab,
      ...(isConversationsTab
        ? {
            // The conversations API cannot express negation, so hide negation
            // operators and add direct-ID matching for conversation searches.
            disallowNegation: true,
            replaceRawSearchKeys: ['gen_ai.conversation.id', 'gen_ai.input.messages'],
            matchKeySuggestions: [
              {key: 'gen_ai.conversation.id', valuePattern: /^[0-9a-fA-F]{8,32}$/},
              {key: 'gen_ai.conversation.id', valuePattern: /^resp_/},
              {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
              {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
            ],
          }
        : {}),
    }),
    [isConversationsTab, searchQuery, setSearchQuery, setSpansCursor, unsetCursor]
  );

  const {spanSearchQueryBuilderProviderProps, spanSearchQueryBuilderProps} =
    useSpanSearchQueryBuilderProps(searchQueryBuilderProps);

  const searchQueryBuilderProviderProps = useMemo(() => {
    if (!isConversationsTab) {
      return spanSearchQueryBuilderProviderProps;
    }

    // Value counts are span-level and can imply conversation results that the
    // list will not return. Strip them for conversation autocomplete.
    const getTagValuesWithoutCounts: GetTagValues = async params => {
      const values = await spanSearchQueryBuilderProviderProps.getTagValues(params);
      return values.map(value =>
        typeof value === 'string' ? value : {value: value.value}
      );
    };

    const fieldDefinitionGetter =
      spanSearchQueryBuilderProviderProps.fieldDefinitionGetter;
    return {
      ...spanSearchQueryBuilderProviderProps,
      filterKeys: {
        ...spanSearchQueryBuilderProviderProps.filterKeys,
        ...CONVERSATION_FILTER_KEYS,
      },
      filterKeySections: [
        {
          value: 'conversation',
          label: t('Conversation'),
          children: Object.keys(CONVERSATION_FILTER_KEYS),
        },
        ...spanSearchQueryBuilderProviderProps.filterKeySections,
      ],
      fieldDefinitionGetter: (key: string, options?: {kind?: FieldKind}) =>
        CONVERSATION_FIELD_DEFINITIONS[key] ?? fieldDefinitionGetter(key, options),
      getTagValues: getTagValuesWithoutCounts,
    };
  }, [isConversationsTab, spanSearchQueryBuilderProviderProps]);

  const resetParamsOnFilterChange = [TableUrlParams.CURSOR, SPANS_CURSOR_URL_PARAM];
  const showSearch = !isOnboardingLoading && !selectedTabShowsOnboarding;

  let content: ReactNode;
  if (isOnboardingLoading) {
    content = <LoadingIndicator />;
  } else if (agentsOverviewEnabled) {
    content = (
      <Fragment>
        {hasAgenticSpans && <AgentsCharts />}
        {isConversationsTab && showMissingMessagesAlert && (
          <ConversationMissingMessagesAlert />
        )}
        <AgentsTable
          activeTab={activeTab}
          hasAgenticSpans={hasAgenticSpans}
          hasConversations={hasConversations}
          onConversationOnboardingDismiss={refetchOnboarding}
          onTabChange={handleTabChange}
        />
      </Fragment>
    );
  } else if (showOnboarding) {
    content = <ConversationOnboarding onDismiss={refetchOnboarding} />;
  } else {
    content = (
      <Fragment>
        {showMissingMessagesAlert && <ConversationMissingMessagesAlert />}
        <ConversationsChart />
        <ConversationsTable />
      </Fragment>
    );
  }

  return (
    <SearchQueryBuilderProvider {...searchQueryBuilderProviderProps}>
      <ExploreBodySearch>
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
              {showSearch && (
                <Flex flex={1} minWidth="300px">
                  <TraceItemSearchQueryBuilder
                    {...spanSearchQueryBuilderProps}
                    placeholder={
                      isConversationsTab
                        ? t('Search or paste a conversation ID')
                        : t('Search spans')
                    }
                  />
                </Flex>
              )}
              {showSearch && isConversationsTab && <SaveConversationQueryButton />}
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
