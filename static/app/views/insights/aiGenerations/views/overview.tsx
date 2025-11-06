import {useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {parseAsString, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {
  EAPSpanSearchQueryBuilder,
  useEAPSpanSearchQueryBuilderProps,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {withChonk} from 'sentry/utils/theme/withChonk';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';
import {useTableCursor} from 'sentry/views/insights/agents/hooks/useTableCursor';
import {Onboarding} from 'sentry/views/insights/agents/views/onboarding';
import {GenerationsChart} from 'sentry/views/insights/aiGenerations/views/components/generationsChart';
import {GenerationsTable} from 'sentry/views/insights/aiGenerations/views/components/generationsTable';
import {GenerationsToolbar} from 'sentry/views/insights/aiGenerations/views/components/generationsToolbar';
import {InsightsEnvironmentSelector} from 'sentry/views/insights/common/components/enviornmentSelector';
import {ModuleFeature} from 'sentry/views/insights/common/components/moduleFeature';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
        <Flex
          gap="md"
          wrap="wrap"
          padding={{
            xs: 'xl xl xl xl',
            md: 'xl 2xl xl 2xl',
          }}
          borderBottom="muted"
        >
          <PageFilterBar condensed>
            <InsightsProjectSelector />
            <InsightsEnvironmentSelector />
            <DatePageFilter {...datePageFilterProps} />
          </PageFilterBar>
          {!showOnboarding && (
            <Flex flex={2} minWidth="50%">
              <EAPSpanSearchQueryBuilder {...eapSpanSearchQueryBuilderProps} />
            </Flex>
          )}
        </Flex>

        {showOnboarding ? (
          <Onboarding />
        ) : (
          <Flex direction={{xs: 'column', md: 'row'}} height="100%">
            {sidebarOpen && (
              <Container
                as="aside"
                padding={{xs: 'md xl', md: 'xl 2xl md 3xl'}}
                width={{xs: 'full', md: '343px'}}
                background="primary"
                borderRight={{md: 'muted'}}
              >
                <GenerationsToolbar numberTags={numberTags} stringTags={stringTags} />
              </Container>
            )}

            <Container
              flex={1}
              padding={{
                xs: 'lg xl 2xl xl',
                md: sidebarOpen ? 'md 2xl xl lg' : 'md 2xl xl 2xl',
              }}
              borderTop="muted"
              background="secondary"
            >
              <Stack direction="column" gap="md" align="start">
                <SidebarCollapseButton
                  sidebarOpen={sidebarOpen}
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  aria-label={sidebarOpen ? t('Collapse sidebar') : t('Expand sidebar')}
                  size="xs"
                  icon={
                    <IconChevron
                      isDouble
                      direction={sidebarOpen ? 'left' : 'right'}
                      size="xs"
                    />
                  }
                >
                  {sidebarOpen ? null : t('Advanced')}
                </SidebarCollapseButton>
                <Stack direction="column" gap="xl" align="start">
                  <GenerationsChart />
                  <GenerationsTable />
                </Stack>
              </Stack>
            </Container>
          </Flex>
        )}
      </ModuleFeature>
    </SearchQueryBuilderProvider>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName={ModuleName.AI_GENERATIONS}>
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <SpansQueryParamsProvider>
          <AIGenerationsPage />
        </SpansQueryParamsProvider>
      </TraceItemAttributeProvider>
    </ModulePageProviders>
  );
}

export default PageWithProviders;

// TODO: This needs streamlining over the explore pages
const SidebarCollapseButton = withChonk(
  styled(Button)<{sidebarOpen: boolean}>`
    ${p =>
      p.sidebarOpen &&
      css`
        display: none;
        border-left-color: ${p.theme.background};
        border-top-left-radius: 0px;
        border-bottom-left-radius: 0px;
        margin-left: -13px;
      `}

    @media (min-width: ${p => p.theme.breakpoints.md}) {
      display: block;
    }
  `,
  chonkStyled(Button)<{sidebarOpen: boolean}>`

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    display: inline-flex;
  }

  ${p =>
    p.sidebarOpen &&
    css`
      display: none;
      margin-left: -13px;

      &::after {
        border-left-color: ${p.theme.background};
        border-top-left-radius: 0px;
        border-bottom-left-radius: 0px;
      }
    `}
`
);
