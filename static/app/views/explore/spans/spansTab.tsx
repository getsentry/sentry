import {Fragment, useCallback, useEffect, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import * as Layout from 'sentry/components/layouts/thirds';
import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
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
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
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
import {ChartSelectionProvider} from 'sentry/views/explore/components/attributeBreakdowns/chartSelectionContext';
import {OverChartButtonGroup} from 'sentry/views/explore/components/overChartButtonGroup';
import SchemaHintsList from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {
  ExploreBodyContent,
  ExploreBodySearch,
  ExploreContentSection,
  ExploreControlSection,
  ExploreFilterSection,
  ExploreSchemaHintsSection,
} from 'sentry/views/explore/components/styles';
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
  useQueryParamsId,
  useQueryParamsMode,
  useQueryParamsQuery,
  useQueryParamsVisualizes,
  useSetQueryParams,
  useSetQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {ExploreCharts} from 'sentry/views/explore/spans/charts';
import {DroppedFieldsAlert} from 'sentry/views/explore/spans/droppedFieldsAlert';
import {ExtrapolationEnabledAlert} from 'sentry/views/explore/spans/extrapolationEnabledAlert';
import {SettingsDropdown} from 'sentry/views/explore/spans/settingsDropdown';
import {SpansExport} from 'sentry/views/explore/spans/spansExport';
import {SpansTabSeerComboBox} from 'sentry/views/explore/spans/spansTabSeerComboBox';
import {ExploreSpansTour, ExploreSpansTourContext} from 'sentry/views/explore/spans/tour';
import {ExploreTables} from 'sentry/views/explore/tables';
import {ExploreToolbar} from 'sentry/views/explore/toolbar';
import {useRawCounts} from 'sentry/views/explore/useRawCounts';
import {
  combineConfidenceForSeries,
  findSuggestedColumns,
} from 'sentry/views/explore/utils';
import {Onboarding} from 'sentry/views/performance/onboarding';

// eslint-disable-next-line no-restricted-imports,boundaries/element-types
import QuotaExceededAlert from 'getsentry/components/performance/quotaExceededAlert';

interface SpansTabOnboardingProps {
  datePageFilterProps: DatePageFilterProps;
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
        <QuotaExceededAlert referrer="spans-explore" traceItemDataset="spans" />
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
  datePageFilterProps: DatePageFilterProps;
}

export function SpansTabContent({datePageFilterProps}: SpanTabProps) {
  useVisitExplore();

  const organization = useOrganization();
  const [controlSectionExpanded, setControlSectionExpanded] = useControlSectionExpanded();

  return (
    <Fragment>
      <ChartSelectionProvider>
        <ExploreBodySearch>
          <SpanTabSearchSection datePageFilterProps={datePageFilterProps} />
        </ExploreBodySearch>
        <ExploreBodyContent>
          <SpanTabControlSection
            organization={organization}
            controlSectionExpanded={controlSectionExpanded}
          />
          <SpanTabContentSection
            setControlSectionExpanded={setControlSectionExpanded}
            controlSectionExpanded={controlSectionExpanded}
          />
        </ExploreBodyContent>
      </ChartSelectionProvider>
    </Fragment>
  );
}

function useVisitExplore() {
  const id = useQueryParamsId();
  const visitQuery = useVisitQuery();
  useEffect(() => {
    if (defined(id)) {
      visitQuery(id);
    }
  }, [id, visitQuery]);
}

interface SpanTabSearchSectionProps {
  datePageFilterProps: DatePageFilterProps;
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
  const setQueryParams = useSetQueryParams();
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

        setQueryParams({
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
      setQueryParams,
      stringSecondaryAliases,
      stringTags,
    ]
  );

  const eapSpanSearchQueryProviderProps = useEAPSpanSearchQueryBuilderProps(
    eapSpanSearchQueryBuilderProps
  );

  return (
    <Layout.Main width="full">
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
          <ExploreFilterSection>
            <StyledPageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter {...datePageFilterProps} />
            </StyledPageFilterBar>
            <SpansSearchBar
              eapSpanSearchQueryBuilderProps={eapSpanSearchQueryBuilderProps}
            />
          </ExploreFilterSection>
          <ExploreSchemaHintsSection>
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
          </ExploreSchemaHintsSection>
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
    <ExploreControlSection expanded={controlSectionExpanded}>
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
    </ExploreControlSection>
  );
}

interface SpanTabContentSectionProps {
  controlSectionExpanded: boolean;
  setControlSectionExpanded: (expanded: boolean) => void;
}

function SpanTabContentSection({
  controlSectionExpanded,
  setControlSectionExpanded,
}: SpanTabContentSectionProps) {
  const {isReady} = usePageFilters();
  const query = useQueryParamsQuery();
  const visualizes = useQueryParamsVisualizes();
  const setVisualizes = useSetQueryParamsVisualizes();
  const extrapolate = useQueryParamsExtrapolate();
  const id = useQueryParamsId();
  const [tab, setTab] = useTab();
  const [caseInsensitive] = useCaseInsensitivity();

  const queryType: 'aggregate' | 'samples' | 'traces' =
    tab === Mode.AGGREGATE ? 'aggregate' : tab === Tab.TRACE ? 'traces' : 'samples';

  const limit = 50;

  const rawSpanCounts = useRawCounts({dataset: DiscoverDatasets.SPANS});

  const aggregatesTableResult = useExploreAggregatesTable({
    query,
    limit,
    enabled: isReady && queryType === 'aggregate',
    queryExtras: {caseInsensitive},
  });
  const spansTableResult = useExploreSpansTable({
    query,
    limit,
    enabled: isReady && queryType === 'samples',
    queryExtras: {caseInsensitive},
  });
  const tracesTableResult = useExploreTracesTable({
    query,
    limit,
    enabled: isReady && queryType === 'traces',
    queryExtras: {caseInsensitive},
  });

  const {result: timeseriesResult, samplingMode: timeseriesSamplingMode} =
    useExploreTimeseries({
      query,
      enabled: isReady,
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
    tab,
    queryType,
    aggregatesTableResult,
    spansTableResult,
    tracesTableResult,
    timeseriesResult,
    interval,
  });

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
    <ExploreContentSection expanded={controlSectionExpanded}>
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
      {defined(id) && <DroppedFieldsAlert />}
      <QuotaExceededAlert referrer="spans-explore" traceItemDataset="spans" />
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
          setTab={setTab}
          rawSpanCounts={rawSpanCounts}
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
    </ExploreContentSection>
  );
}

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
