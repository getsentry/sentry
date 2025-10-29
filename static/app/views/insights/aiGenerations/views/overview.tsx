import {useMemo} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {Flex, Stack} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {
  EAPSpanSearchQueryBuilder,
  useEAPSpanSearchQueryBuilderProps,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';
import {useTableCursor} from 'sentry/views/insights/agents/hooks/useTableCursor';
import {Onboarding} from 'sentry/views/insights/agents/views/onboarding';
import {GenerationsChart} from 'sentry/views/insights/aiGenerations/views/components/generationsChart';
import {GenerationsTable} from 'sentry/views/insights/aiGenerations/views/components/generationsTable';
import {InsightsEnvironmentSelector} from 'sentry/views/insights/common/components/enviornmentSelector';
import {ModuleFeature} from 'sentry/views/insights/common/components/moduleFeature';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {ModuleName} from 'sentry/views/insights/types';

function useShowOnboarding() {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const selectedProjects = getSelectedProjectList(
    pageFilters.selection.projects,
    projects
  );

  return !selectedProjects.some(p => p.hasInsightsAgentMonitoring);
}

function AIGenerationsPage() {
  const organization = useOrganization();
  const showOnboarding = useShowOnboarding();
  const datePageFilterProps = limitMaxPickableDays(organization);
  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withOptions({history: 'replace'})
  );
  const {unsetCursor} = useTableCursor();

  const {tags: numberTags, secondaryAliases: numberSecondaryAliases} =
    useTraceItemTags('number');
  const {tags: stringTags, secondaryAliases: stringSecondaryAliases} =
    useTraceItemTags('string');

  const hasRawSearchReplacement = organization.features.includes(
    'search-query-builder-raw-search-replacement'
  );

  const eapSpanSearchQueryBuilderProps = useMemo(
    () => ({
      initialQuery: searchQuery ?? '',
      onSearch: (newQuery: string) => {
        setSearchQuery(newQuery);
        unsetCursor();
      },
      searchSource: 'ai-generations',
      numberTags,
      stringTags,
      numberSecondaryAliases,
      stringSecondaryAliases,
      replaceRawSearchKeys: hasRawSearchReplacement ? ['span.description'] : undefined,
      matchKeySuggestions: [
        {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
        {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
      ],
    }),
    [
      hasRawSearchReplacement,
      numberSecondaryAliases,
      numberTags,
      searchQuery,
      setSearchQuery,
      stringSecondaryAliases,
      stringTags,
      unsetCursor,
    ]
  );

  const eapSpanSearchQueryProviderProps = useEAPSpanSearchQueryBuilderProps(
    eapSpanSearchQueryBuilderProps
  );

  return (
    <SearchQueryBuilderProvider {...eapSpanSearchQueryProviderProps}>
      <ModuleFeature moduleName={ModuleName.AI_GENERATIONS}>
        <Layout.Body>
          <Layout.Main width="full">
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <ToolRibbon>
                  <PageFilterBar condensed>
                    <InsightsProjectSelector />
                    <InsightsEnvironmentSelector />
                    <DatePageFilter {...datePageFilterProps} />
                  </PageFilterBar>
                  {!showOnboarding && (
                    <Flex flex={2}>
                      <EAPSpanSearchQueryBuilder {...eapSpanSearchQueryBuilderProps} />
                    </Flex>
                  )}
                </ToolRibbon>
              </ModuleLayout.Full>

              <ModuleLayout.Full>
                {showOnboarding ? (
                  <Onboarding />
                ) : (
                  <Stack direction="column" gap="xl">
                    <GenerationsChart />
                    <GenerationsTable />
                  </Stack>
                )}
              </ModuleLayout.Full>
            </ModuleLayout.Layout>
          </Layout.Main>
        </Layout.Body>
      </ModuleFeature>
    </SearchQueryBuilderProvider>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName={ModuleName.AI_GENERATIONS}>
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <AIGenerationsPage />
      </TraceItemAttributeProvider>
    </ModulePageProviders>
  );
}

export default PageWithProviders;
