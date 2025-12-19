import {useMemo} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {Flex, Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {
  useSpanSearchQueryBuilderProps,
  type UseSpanSearchQueryBuilderProps,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {DataCategory} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import useOrganization from 'sentry/utils/useOrganization';
import SchemaHintsList from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {InsightsEnvironmentSelector} from 'sentry/views/insights/common/components/enviornmentSelector';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useDefaultToAllProjects} from 'sentry/views/insights/common/utils/useDefaultToAllProjects';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';
import {TableUrlParams} from 'sentry/views/insights/pages/agents/utils/urlParams';
import {AgentSelector} from 'sentry/views/insights/pages/conversations/components/agentSelector';
import {ConversationsTable} from 'sentry/views/insights/pages/conversations/components/conversationsTable';
import {DomainOverviewPageProviders} from 'sentry/views/insights/pages/domainOverviewPageProviders';

const DISABLE_AGGREGATES: never[] = [];

interface ConversationsOverviewPageProps {
  datePageFilterProps: DatePageFilterProps;
}

function ConversationsOverviewPage({
  datePageFilterProps,
}: ConversationsOverviewPageProps) {
  const organization = useOrganization();
  useDefaultToAllProjects();

  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withOptions({history: 'replace'})
  );
  const {unsetCursor} = useTableCursor();

  const {tags: numberTags = [], isLoading: numberTagsLoading} =
    useTraceItemTags('number');
  const {tags: stringTags = [], isLoading: stringTagsLoading} =
    useTraceItemTags('string');

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
      replaceRawSearchKeys: hasRawSearchReplacement ? ['span.description'] : undefined,
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
      <Feature
        features="performance-view"
        organization={organization}
        renderDisabled={NoAccess}
      >
        <Feature
          features="gen-ai-conversations"
          organization={organization}
          renderDisabled={NoAccess}
        >
          <Layout.Body>
            <Layout.Main width="full">
              <ModuleLayout.Layout>
                <ModuleLayout.Full>
                  <Stack gap="md">
                    <ToolRibbon>
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
                      <AgentSelector />
                      <Flex flex={2}>
                        <TraceItemSearchQueryBuilder {...spanSearchQueryBuilderProps} />
                      </Flex>
                    </ToolRibbon>
                    <SchemaHintsList
                      supportedAggregates={DISABLE_AGGREGATES}
                      numberTags={numberTags as TagCollection}
                      stringTags={stringTags as TagCollection}
                      isLoading={numberTagsLoading || stringTagsLoading}
                      exploreQuery={searchQuery ?? ''}
                      source={SchemaHintsSources.CONVERSATIONS}
                    />
                  </Stack>
                </ModuleLayout.Full>

                <ModuleLayout.Full>
                  <ConversationsTable />
                </ModuleLayout.Full>
              </ModuleLayout.Layout>
            </Layout.Main>
          </Layout.Body>
        </Feature>
      </Feature>
    </SearchQueryBuilderProvider>
  );
}

function PageWithProviders() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <DomainOverviewPageProviders maxPickableDays={datePageFilterProps.maxPickableDays}>
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <ConversationsOverviewPage datePageFilterProps={datePageFilterProps} />
      </TraceItemAttributeProvider>
    </DomainOverviewPageProviders>
  );
}

export default PageWithProviders;
