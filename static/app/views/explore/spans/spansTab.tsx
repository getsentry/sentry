import {Fragment, useCallback, useEffect, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

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
import {TourElement} from 'sentry/components/tours/components';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {
  type AggregationKey,
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
} from 'sentry/utils/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {withChonk} from 'sentry/utils/theme/withChonk';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import {ExploreCharts} from 'sentry/views/explore/charts';
import SchemaHintsList, {
  SchemaHintsSection,
} from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {SeerSearch} from 'sentry/views/explore/components/seerSearch';
import {
  useExploreFields,
  useExploreId,
  useExploreMode,
  useExploreQuery,
  useExploreVisualizes,
  useSetExplorePageParams,
  useSetExploreVisualizes,
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
import {useTraceExploreAiQuerySetup} from 'sentry/views/explore/hooks/useTraceExploreAiQuerySetup';
import {useVisitQuery} from 'sentry/views/explore/hooks/useVisitQuery';
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
  const location = useLocation();
  const navigate = useNavigate();
  const controlSectionExpanded = decodeScalar(location.query.toolbar);
  const setControlSectionExpanded = useCallback(
    (expanded: boolean) => {
      const newControlSectionExpanded = expanded ? undefined : 'collapsed';
      navigate({
        ...location,
        query: {
          ...location.query,
          toolbar: newControlSectionExpanded,
        },
      });
    },
    [location, navigate]
  );

  return [controlSectionExpanded !== 'collapsed', setControlSectionExpanded] as const;
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
  const {displaySeerResults, query} = useSearchQueryBuilder();

  return displaySeerResults ? (
    <SeerSearch initialQuery={query} />
  ) : (
    <EAPSpanSearchQueryBuilder autoFocus {...eapSpanSearchQueryBuilderProps} />
  );
}

function SpanTabSearchSection({datePageFilterProps}: SpanTabSearchSectionProps) {
  const mode = useExploreMode();
  const fields = useExploreFields();
  const query = useExploreQuery();
  const setExplorePageParams = useSetExplorePageParams();

  const organization = useOrganization();
  const areAiFeaturesAllowed =
    !organization?.hideAiFeatures && organization.features.includes('gen-ai-features');

  useTraceExploreAiQuerySetup({enableAISearch: areAiFeaturesAllowed});

  const {tags: numberTags, isLoading: numberTagsLoading} = useTraceItemTags('number');
  const {tags: stringTags, isLoading: stringTagsLoading} = useTraceItemTags('string');

  const search = useMemo(() => new MutableSearch(query), [query]);
  const oldSearch = usePrevious(search);

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
      replaceRawSearchKeys: ['span.description'],
    }),
    [fields, mode, query, setExplorePageParams, numberTags, stringTags, oldSearch]
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
          'Based on your search, you can determine how you want your results shown. Choose your metric visualization, group (Optional) and sort.'
        )}
        position="right"
        margin={-8}
      >
        <ExploreToolbar width={300} extras={toolbarExtras} />
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
  const mode = useExploreMode();
  const visualizes = useExploreVisualizes();
  const setVisualizes = useSetExploreVisualizes();
  const [samplesTab, setSamplesTab] = useTab();

  const query = useExploreQuery();

  const queryType: 'aggregate' | 'samples' | 'traces' =
    mode === Mode.AGGREGATE
      ? 'aggregate'
      : samplesTab === Tab.TRACE
        ? 'traces'
        : 'samples';

  const limit = 50;

  const isAllowedSelection = useMemo(
    () => checkIsAllowedSelection(selection, maxPickableDays),
    [selection, maxPickableDays]
  );

  const aggregatesTableResult = useExploreAggregatesTable({
    query,
    limit,
    enabled: isAllowedSelection && queryType === 'aggregate',
  });
  const spansTableResult = useExploreSpansTable({
    query,
    limit,
    enabled: isAllowedSelection && queryType === 'samples',
  });
  const tracesTableResult = useExploreTracesTable({
    query,
    limit,
    enabled: isAllowedSelection && queryType === 'traces',
  });

  const {
    result: timeseriesResult,
    canUsePreviousResults,
    samplingMode: timeseriesSamplingMode,
  } = useExploreTimeseries({
    query,
    enabled: isAllowedSelection,
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
      <ChevronButton
        aria-label={controlSectionExpanded ? t('Collapse sidebar') : t('Expand sidebar')}
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
      />
      {!resultsLoading && !hasResults && <QuotaExceededAlert referrer="explore" />}
      {defined(error) && (
        <Alert.Container>
          <Alert type="error" showIcon>
            {error.message}
          </Alert>
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
          canUsePreviousResults={canUsePreviousResults}
          confidences={confidences}
          query={query}
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
          samplesTab={samplesTab}
          setSamplesTab={setSamplesTab}
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
  padding-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding-bottom: ${space(2)};
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
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    border-bottom: none;
    ${p =>
      p.expanded
        ? css`
            width: 343px; /* 300px for the toolbar + padding */
            padding: ${space(2)} ${space(1.5)} ${space(1)} ${space(4)};
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

  padding: ${space(1)} ${space(2)} ${space(3)} ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    ${p =>
      p.expanded
        ? css`
            padding: ${space(1)} ${space(4)} ${space(3)} ${space(1.5)};
          `
        : css`
            padding: ${space(1)} ${space(4)} ${space(3)} ${space(4)};
          `}
  }
`;

const FilterSection = styled('div')`
  display: grid;
  gap: ${space(1)};

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

const ChevronButton = withChonk(
  styled(Button)<{expanded: boolean}>`
    width: 28px;
    border-left-color: ${p => p.theme.background};
    border-top-left-radius: 0px;
    border-bottom-left-radius: 0px;
    margin-bottom: ${space(1)};
    display: none;

    @media (min-width: ${p => p.theme.breakpoints.md}) {
      display: block;
    }

    ${p =>
      p.expanded
        ? css`
            margin-left: -13px;
          `
        : css`
            margin-left: -31px;
          `}
  `,
  chonkStyled(Button)<{expanded: boolean}>`
    margin-bottom: ${space(1)};
    display: none;
    margin-left: ${p => (p.expanded ? '-13px' : '-31px')};

    @media (min-width: ${p => p.theme.breakpoints.md}) {
      display: inline-flex;
    }

    &::after {
      border-left-color: ${p => p.theme.background};
      border-top-left-radius: 0px;
      border-bottom-left-radius: 0px;
    }
  `
);

const StyledSchemaHintsSection = styled(SchemaHintsSection)`
  margin-top: ${space(1)};
  margin-bottom: 0px;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    margin-top: ${space(1)};
    margin-bottom: 0px;
  }
`;
