import {Fragment, useCallback, useEffect, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import type {EAPSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {
  EAPSpanSearchQueryBuilder,
  useEAPSpanSearchQueryBuilderProps,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilder,
} from 'sentry/components/searchQueryBuilder/context';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {TourElement} from 'sentry/components/tours/components';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  type AggregationKey,
} from 'sentry/utils/fields';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {withChonk} from 'sentry/utils/theme/withChonk';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import {OverChartButtonGroup} from 'sentry/views/explore/components/overChartButtonGroup';
import SchemaHintsList, {
  SchemaHintsSection,
} from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {
  useExploreId,
  useSetExplorePageParams,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useExploreAggregatesTable} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import {useExploreSpansTable} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {useExploreTimeseries} from 'sentry/views/explore/hooks/useExploreTimeseries';
import {useExploreTracesTable} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';
import {useVisitQuery} from 'sentry/views/explore/hooks/useVisitQuery';
import {
  useQueryParamsExtrapolate,
  useQueryParamsFields,
  useQueryParamsMode,
  useQueryParamsQuery,
  useQueryParamsVisualizes,
  useSetQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {ExploreCharts} from 'sentry/views/explore/spans/charts';
import {ExtrapolationEnabledAlert} from 'sentry/views/explore/spans/extrapolationEnabledAlert';
import {SettingsDropdown} from 'sentry/views/explore/spans/settingsDropdown';
import {SpansExport} from 'sentry/views/explore/spans/spansExport';
import {SpansTabSeerComboBox} from 'sentry/views/explore/spans/spansTabSeerComboBox';
import {ExploreSpansTour, ExploreSpansTourContext} from 'sentry/views/explore/spans/tour';
import {ExploreTables} from 'sentry/views/explore/tables';
import {ExploreToolbar} from 'sentry/views/explore/toolbar';
import {
  combineConfidenceForSeries,
  findSuggestedColumns,
  type PickableDays,
} from 'sentry/views/explore/utils';
import {Onboarding} from 'sentry/views/performance/onboarding';

// eslint-disable-next-line no-restricted-imports,boundaries/element-types
import QuotaExceededAlert from 'getsentry/components/performance/quotaExceededAlert';

interface SpansTabOnboardingProps {
  datePageFilterProps: PickableDays;
  organization: Organization;
  project: Project;
}

export function SpansTabOnboarding({
  datePageFilterProps,
  organization,
  project,
}: SpansTabOnboardingProps) {
  return (
    <Layout.Body>
      <PageFilterBar condensed>
        <ProjectPageFilter />
        <EnvironmentPageFilter />
        <DatePageFilter {...datePageFilterProps} />
      </PageFilterBar>
      <OnboardingContentSection>
        <Onboarding project={project} organization={organization} />
      </OnboardingContentSection>
    </Layout.Body>
  );
}

function useControlSectionExpanded() {
  const [controlSectionExpanded, _setControlSectionExpanded] = useLocalStorageState(
    'explore-spans-toolbar',
    'expanded'
  );

  const setControlSectionExpanded = useCallback(
    (expanded: boolean) => {
      _setControlSectionExpanded(expanded ? 'expanded' : '');
    },
    [_setControlSectionExpanded]
  );

  return [controlSectionExpanded === 'expanded', setControlSectionExpanded] as const;
}

interface SpanTabProps {
  datePageFilterProps: PickableDays;
}

export function SpansTabContent({datePageFilterProps}: SpanTabProps) {
  useVisitExplore();

  const organization = useOrganization();
  const [controlSectionExpanded, setControlSectionExpanded] = useControlSectionExpanded();

  return (
    <Fragment>
      <BodySearch>
        <SpanTabSearchSection datePageFilterProps={datePageFilterProps} />
      </BodySearch>
      <BodyContent>
        <SpanTabControlSection
          organization={organization}
          controlSectionExpanded={controlSectionExpanded}
        />
        <SpanTabContentSection
          maxPickableDays={datePageFilterProps.maxPickableDays}
          setControlSectionExpanded={setControlSectionExpanded}
          controlSectionExpanded={controlSectionExpanded}
        />
      </BodyContent>
    </Fragment>
  );
}

function useVisitExplore() {
  const id = useExploreId();
  const visitQuery = useVisitQuery();
  useEffect(() => {
    if (defined(id)) {
      visitQuery(id);
    }
  }, [id, visitQuery]);
}

interface SpanTabSearchSectionProps {
  datePageFilterProps: PickableDays;
}

function SpansSearchBar({
  eapSpanSearchQueryBuilderProps,
}: {
  eapSpanSearchQueryBuilderProps: EAPSpanSearchQueryBuilderProps;
}) {
  const {displayAskSeer} = useSearchQueryBuilder();

  if (displayAskSeer) {
    return <SpansTabSeerComboBox />;
  }

  return <EAPSpanSearchQueryBuilder autoFocus {...eapSpanSearchQueryBuilderProps} />;
}

function SpanTabSearchSection({datePageFilterProps}: SpanTabSearchSectionProps) {
  const mode = useQueryParamsMode();
  const fields = useQueryParamsFields();
  const query = useQueryParamsQuery();
  const setExplorePageParams = useSetExplorePageParams();
  const [caseInsensitive, setCaseInsensitive] = useCaseInsensitivity();

  const organization = useOrganization();
  const areAiFeaturesAllowed =
    !organization?.hideAiFeatures && organization.features.includes('gen-ai-features');

  const {
    tags: numberTags,
    isLoading: numberTagsLoading,
    secondaryAliases: numberSecondaryAliases,
  } = useTraceItemTags('number');
  const {
    tags: stringTags,
    isLoading: stringTagsLoading,
    secondaryAliases: stringSecondaryAliases,
  } = useTraceItemTags('string');

  const search = useMemo(() => new MutableSearch(query), [query]);
  const oldSearch = usePrevious(search);

  const hasRawSearchReplacement = organization.features.includes(
    'search-query-builder-raw-search-replacement'
  );

  const eapSpanSearchQueryBuilderProps = useMemo(
    () => ({
      initialQuery: query,
      onSearch: (newQuery: string) => {
        const newSearch = new MutableSearch(newQuery);
        const suggestedColumns = findSuggestedColumns(newSearch, oldSearch, {
          numberAttributes: numberTags,
          stringAttributes: stringTags,
        });

        const existingFields = new Set(fields);
        const newColumns = suggestedColumns.filter(col => !existingFields.has(col));

        setExplorePageParams({
          query: newQuery,
          fields: newColumns.length ? [...fields, ...newColumns] : undefined,
        });
      },
      searchSource: 'explore',
      getFilterTokenWarning:
        mode === Mode.SAMPLES
          ? (key: string) => {
              if (ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.includes(key as AggregationKey)) {
                return t(
                  "This key won't affect the results because samples mode does not support aggregate functions"
                );
              }
              return undefined;
            }
          : undefined,
      supportedAggregates:
        mode === Mode.SAMPLES ? [] : ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
      numberTags,
      stringTags,
      replaceRawSearchKeys: hasRawSearchReplacement ? ['span.description'] : undefined,
      matchKeySuggestions: [
        {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
        {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
      ],
      numberSecondaryAliases,
      stringSecondaryAliases,
      caseInsensitive,
      onCaseInsensitiveClick: setCaseInsensitive,
    }),
    [
      caseInsensitive,
      fields,
      hasRawSearchReplacement,
      mode,
      numberSecondaryAliases,
      numberTags,
      oldSearch,
      query,
      setCaseInsensitive,
      setExplorePageParams,
      stringSecondaryAliases,
      stringTags,
    ]
  );

  const eapSpanSearchQueryProviderProps = useEAPSpanSearchQueryBuilderProps(
    eapSpanSearchQueryBuilderProps
  );

  return (
    <Layout.Main fullWidth>
      <SearchQueryBuilderProvider
        enableAISearch={areAiFeaturesAllowed}
        {...eapSpanSearchQueryProviderProps}
      >
        <TourElement<ExploreSpansTour>
          tourContext={ExploreSpansTourContext}
          id={ExploreSpansTour.SEARCH_BAR}
          title={t('Start Your Search')}
          description={t(
            'Specify the keys you’d like to narrow your search down to (ex. span.operation) and then any values (ex. db, res, http, etc.).'
          )}
          position="bottom"
          margin={-8}
        >
          <FilterSection>
            <StyledPageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter {...datePageFilterProps} />
            </StyledPageFilterBar>
            <SpansSearchBar
              eapSpanSearchQueryBuilderProps={eapSpanSearchQueryBuilderProps}
            />
          </FilterSection>
          <StyledSchemaHintsSection>
            <SchemaHintsList
              supportedAggregates={
                mode === Mode.SAMPLES ? [] : ALLOWED_EXPLORE_VISUALIZE_AGGREGATES
              }
              numberTags={numberTags}
              stringTags={stringTags}
              isLoading={numberTagsLoading || stringTagsLoading}
              exploreQuery={query}
              source={SchemaHintsSources.EXPLORE}
            />
          </StyledSchemaHintsSection>
        </TourElement>
      </SearchQueryBuilderProvider>
    </Layout.Main>
  );
}

interface SpanTabControlSectionProps {
  controlSectionExpanded: boolean;
  organization: Organization;
}

function SpanTabControlSection({
  controlSectionExpanded,
  organization,
}: SpanTabControlSectionProps) {
  const toolbarExtras = [
    ...(organization?.features?.includes('visibility-explore-equations')
      ? ['equations' as const]
      : []),
  ];

  return (
    <ControlSection expanded={controlSectionExpanded}>
      <TourElement<ExploreSpansTour>
        tourContext={ExploreSpansTourContext}
        id={ExploreSpansTour.TOOLBAR}
        title={t('Configure Your Query')}
        description={t(
          'Based on your search, you can determine how you want your results shown. Choose your metric visualization, group (optional) and sort.'
        )}
        position="right"
        margin={-8}
      >
        {controlSectionExpanded && <ExploreToolbar width={300} extras={toolbarExtras} />}
      </TourElement>
    </ControlSection>
  );
}

interface SpanTabContentSectionProps {
  controlSectionExpanded: boolean;
  maxPickableDays: PickableDays['maxPickableDays'];
  setControlSectionExpanded: (expanded: boolean) => void;
}

function SpanTabContentSection({
  maxPickableDays,
  controlSectionExpanded,
  setControlSectionExpanded,
}: SpanTabContentSectionProps) {
  const {selection} = usePageFilters();
  const query = useQueryParamsQuery();
  const visualizes = useQueryParamsVisualizes();
  const setVisualizes = useSetQueryParamsVisualizes();
  const extrapolate = useQueryParamsExtrapolate();
  const [tab, setTab] = useTab();
  const [caseInsensitive] = useCaseInsensitivity();

  const queryType: 'aggregate' | 'samples' | 'traces' =
    tab === Mode.AGGREGATE ? 'aggregate' : tab === Tab.TRACE ? 'traces' : 'samples';

  const limit = 50;

  const isAllowedSelection = useMemo(
    () => checkIsAllowedSelection(selection, maxPickableDays),
    [selection, maxPickableDays]
  );

  const aggregatesTableResult = useExploreAggregatesTable({
    query,
    limit,
    enabled: isAllowedSelection && queryType === 'aggregate',
    queryExtras: {caseInsensitive},
  });
  const spansTableResult = useExploreSpansTable({
    query,
    limit,
    enabled: isAllowedSelection && queryType === 'samples',
    queryExtras: {caseInsensitive},
  });
  const tracesTableResult = useExploreTracesTable({
    query,
    limit,
    enabled: isAllowedSelection && queryType === 'traces',
    queryExtras: {caseInsensitive},
  });

  const {result: timeseriesResult, samplingMode: timeseriesSamplingMode} =
    useExploreTimeseries({
      query,
      enabled: isAllowedSelection,
      queryExtras: {caseInsensitive},
    });

  const confidences = useMemo(
    () =>
      visualizes.map(visualize => {
        const dedupedYAxes = [visualize.yAxis];
        const series = dedupedYAxes
          .flatMap(yAxis => timeseriesResult.data[yAxis])
          .filter(defined);
        return combineConfidenceForSeries(series);
      }),
    [timeseriesResult.data, visualizes]
  );

  const [interval] = useChartInterval();

  useAnalytics({
    queryType,
    aggregatesTableResult,
    spansTableResult,
    tracesTableResult,
    timeseriesResult,
    interval,
  });

  const resultsLength =
    {
      aggregate: aggregatesTableResult.result.data?.length,
      samples: spansTableResult.result.data?.length,
      traces: tracesTableResult.result.data?.data?.length,
    }[queryType] ?? 0;

  const hasResults = !!resultsLength;

  const resultsLoading =
    queryType === 'aggregate'
      ? aggregatesTableResult.result.isPending
      : queryType === 'samples'
        ? spansTableResult.result.isPending
        : tracesTableResult.result.isPending;

  const error = defined(timeseriesResult.error)
    ? null // if the timeseries errors, we prefer to show that error in the chart
    : queryType === 'samples'
      ? spansTableResult.result.error
      : queryType === 'traces'
        ? tracesTableResult.result.error
        : queryType === 'aggregate'
          ? aggregatesTableResult.result.error
          : null;

  return (
    <ContentSection expanded={controlSectionExpanded}>
      <OverChartButtonGroup>
        <ChevronButton
          aria-label={
            controlSectionExpanded ? t('Collapse sidebar') : t('Expand sidebar')
          }
          expanded={controlSectionExpanded}
          size="xs"
          icon={
            <IconChevron
              isDouble
              direction={controlSectionExpanded ? 'left' : 'right'}
              size="xs"
            />
          }
          onClick={() => setControlSectionExpanded(!controlSectionExpanded)}
        >
          {controlSectionExpanded ? null : t('Advanced')}
        </ChevronButton>
        <ActionButtonsGroup>
          <Feature features="organizations:tracing-export-csv">
            <SpansExport
              aggregatesTableResult={aggregatesTableResult}
              spansTableResult={spansTableResult}
            />
          </Feature>
          <SettingsDropdown />
        </ActionButtonsGroup>
      </OverChartButtonGroup>
      {!resultsLoading && !hasResults && (
        <QuotaExceededAlert referrer="spans-explore" traceItemDataset="spans" />
      )}
      <ExtrapolationEnabledAlert />
      {defined(error) && (
        <Alert.Container>
          <Alert type="error">{error.message}</Alert>
        </Alert.Container>
      )}
      <TourElement<ExploreSpansTour>
        tourContext={ExploreSpansTourContext}
        id={ExploreSpansTour.RESULTS}
        title={t('Get Results')}
        description={t(
          'See a chart and list of samples or aggregates. IDs will link you to a waterfall for debugging while aggregates will let you scope it down further.'
        )}
        position="top"
        margin={-8}
      >
        <ExploreCharts
          confidences={confidences}
          query={query}
          extrapolate={extrapolate}
          timeseriesResult={timeseriesResult}
          visualizes={visualizes}
          setVisualizes={setVisualizes}
          samplingMode={timeseriesSamplingMode}
        />
        <ExploreTables
          aggregatesTableResult={aggregatesTableResult}
          spansTableResult={spansTableResult}
          tracesTableResult={tracesTableResult}
          confidences={confidences}
          tab={tab}
          setTab={(newTab: Mode | Tab) => {
            if (newTab === Mode.AGGREGATE) {
              setControlSectionExpanded(true);
            }
            setTab(newTab);
          }}
        />
      </TourElement>
    </ContentSection>
  );
}

function checkIsAllowedSelection(
  selection: PageFilters,
  maxPickableDays: PickableDays['maxPickableDays']
) {
  const maxPickableMinutes = maxPickableDays * 24 * 60;
  const selectedMinutes = getDiffInMinutes(selection.datetime);
  return selectedMinutes <= maxPickableMinutes;
}

const BodySearch = styled(Layout.Body)`
  flex-grow: 0;
  border-bottom: 1px solid ${p => p.theme.border};
  padding-bottom: ${p => p.theme.space.xl};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding-bottom: ${p => p.theme.space.xl};
  }
`;

const BodyContent = styled('div')`
  background-color: ${p => p.theme.background};
  flex-grow: 1;

  display: flex;
  flex-direction: column;
  padding: 0px;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    display: flex;
    flex-direction: row;
    padding: 0px;
    gap: 0px;
  }
`;

const ControlSection = styled('aside')<{expanded: boolean}>`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.border};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    border-bottom: none;
    ${p =>
      p.expanded
        ? css`
            width: 343px; /* 300px for the toolbar + padding */
            padding: ${p.theme.space.xl} ${p.theme.space.lg} ${p.theme.space.md}
              ${p.theme.space['3xl']};
            border-right: 1px solid ${p.theme.border};
          `
        : css`
            overflow: hidden;
            width: 0px;
            padding: 0px;
            border-right: none;
          `}
  }
`;

const ContentSection = styled('section')<{expanded: boolean}>`
  background-color: ${p => p.theme.backgroundSecondary};
  flex: 1 1 auto;
  min-width: 0;

  padding-top: ${p => p.theme.space.md};
  padding-right: ${p => p.theme.space.xl};
  padding-bottom: ${p => p.theme.space['2xl']};
  padding-left: ${p => p.theme.space.xl};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    ${p =>
      p.expanded
        ? css`
            padding: ${p.theme.space.md} ${p.theme.space['3xl']} ${p.theme.space['2xl']}
              ${p.theme.space.lg};
          `
        : css`
            padding: ${p.theme.space.md} ${p.theme.space['3xl']} ${p.theme.space['2xl']}
              ${p.theme.space['3xl']};
          `}
  }
`;

const FilterSection = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.md};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: minmax(300px, auto) 1fr;
  }
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  width: auto;
`;

const OnboardingContentSection = styled('section')`
  grid-column: 1/3;
`;

const ActionButtonsGroup = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.xs};
`;

const ChevronButton = withChonk(
  styled(Button)<{expanded: boolean}>`
    display: none;

    @media (min-width: ${p => p.theme.breakpoints.md}) {
      display: block;
    }

    ${p =>
      p.expanded &&
      css`
        margin-left: -13px;
        border-left-color: ${p.theme.background};
        border-top-left-radius: 0px;
        border-bottom-left-radius: 0px;
      `}
  `,
  chonkStyled(Button)<{expanded: boolean}>`
    display: none;

    @media (min-width: ${p => p.theme.breakpoints.md}) {
      display: inline-flex;
    }

    ${p =>
      p.expanded &&
      css`
        margin-left: -13px;

        &::after {
          border-left-color: ${p.theme.background};
          border-top-left-radius: 0px;
          border-bottom-left-radius: 0px;
        }
      `}
  `
);

const StyledSchemaHintsSection = styled(SchemaHintsSection)`
  margin-top: ${p => p.theme.space.md};
  margin-bottom: 0px;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    margin-top: ${p => p.theme.space.md};
    margin-bottom: 0px;
  }
`;
