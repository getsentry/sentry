import {useCallback, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {parseAsString, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {openModal} from 'sentry/actionCreators/modal';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {
  EAPSpanSearchQueryBuilder,
  useEAPSpanSearchQueryBuilderProps,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {IconChevron, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {withChonk} from 'sentry/utils/theme/withChonk';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import SchemaHintsList from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {TableActionButton} from 'sentry/views/explore/components/tableActionButton';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';
import {GenerationsChart} from 'sentry/views/insights/aiGenerations/views/components/generationsChart';
import {GenerationsTable} from 'sentry/views/insights/aiGenerations/views/components/generationsTable';
import {GenerationsToolbar} from 'sentry/views/insights/aiGenerations/views/components/generationsToolbar';
import {INPUT_OUTPUT_FIELD} from 'sentry/views/insights/aiGenerations/views/utils/constants';
import {useFieldsQueryParam} from 'sentry/views/insights/aiGenerations/views/utils/useFieldsQueryParam';
import {InsightsEnvironmentSelector} from 'sentry/views/insights/common/components/enviornmentSelector';
import {ModuleFeature} from 'sentry/views/insights/common/components/moduleFeature';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';
import {Onboarding} from 'sentry/views/insights/pages/agents/onboarding';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';

const DISABLE_AGGREGATES: never[] = [];

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
  const [caseInsensitive, setCaseInsensitive] = useCaseInsensitivity();

  const [searchQuery, setSearchQuery] = useQueryState(
    'query',
    parseAsString.withOptions({history: 'replace'})
  );
  const {unsetCursor} = useTableCursor();

  const [fields, setFields] = useFieldsQueryParam();

  const {
    tags: numberTags,
    secondaryAliases: numberSecondaryAliases,
    isLoading: numberTagsLoading,
  } = useTraceItemTags('number');
  const {
    tags: stringTags,
    secondaryAliases: stringSecondaryAliases,
    isLoading: stringTagsLoading,
  } = useTraceItemTags('string');

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
      caseInsensitive,
      onCaseInsensitiveClick: setCaseInsensitive,
    }),
    [
      caseInsensitive,
      hasRawSearchReplacement,
      numberSecondaryAliases,
      numberTags,
      searchQuery,
      setCaseInsensitive,
      setSearchQuery,
      stringSecondaryAliases,
      stringTags,
      unsetCursor,
    ]
  );

  const eapSpanSearchQueryProviderProps = useEAPSpanSearchQueryBuilderProps(
    eapSpanSearchQueryBuilderProps
  );

  const openColumnEditor = useCallback(() => {
    openModal(
      modalProps => (
        <ColumnEditorModal
          {...modalProps}
          columns={fields.slice()}
          requiredTags={[SpanFields.ID, INPUT_OUTPUT_FIELD]}
          onColumnsChange={setFields as any}
          stringTags={stringTags}
          numberTags={numberTags}
          handleReset={() => setFields(null)}
          isDocsButtonHidden
        />
      ),
      {closeEvents: 'escape-key'}
    );
  }, [fields, setFields, stringTags, numberTags]);

  return (
    <SearchQueryBuilderProvider {...eapSpanSearchQueryProviderProps}>
      <ModuleFeature moduleName={ModuleName.AI_GENERATIONS}>
        <Stack
          direction="column"
          gap="md"
          borderBottom="muted"
          padding={{
            xs: 'xl xl xl xl',
            md: 'xl 2xl xl 2xl',
          }}
        >
          <Flex gap="md" wrap="wrap">
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
          <SchemaHintsList
            supportedAggregates={DISABLE_AGGREGATES}
            numberTags={numberTags}
            stringTags={stringTags}
            isLoading={numberTagsLoading || stringTagsLoading}
            exploreQuery={searchQuery ?? ''}
            source={SchemaHintsSources.AI_GENERATIONS}
          />
        </Stack>

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
              <Stack direction="column" gap="md">
                <Container alignSelf="start">
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
                </Container>
                <GenerationsChart />
                <Container alignSelf="end">
                  <TableActionButton
                    mobile={
                      <Button
                        onClick={openColumnEditor}
                        icon={<IconEdit />}
                        size="sm"
                        aria-label={t('Edit Table')}
                      />
                    }
                    desktop={
                      <Button
                        onClick={openColumnEditor}
                        icon={<IconEdit />}
                        size="sm"
                        aria-label={t('Edit Table')}
                      >
                        {t('Edit Table')}
                      </Button>
                    }
                  />
                </Container>
                <GenerationsTable />
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
