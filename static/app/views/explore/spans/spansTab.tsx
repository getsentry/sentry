import {useEffect, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import Feature from 'sentry/components/acl/feature';
import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {Button} from 'sentry/components/core/button';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {
  EAPSpanSearchQueryBuilder,
  useEAPSpanSearchQueryBuilderProps,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {TourElement} from 'sentry/components/tours/components';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import {isAggregateField} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  type AggregationKey,
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ExploreCharts} from 'sentry/views/explore/charts';
import SchemaHintsList, {
  SchemaHintsSection,
} from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {
  PageParamsProvider,
  useExploreDataset,
  useExploreFields,
  useExploreId,
  useExploreMode,
  useExploreQuery,
  useExploreVisualizes,
  useSetExplorePageParams,
  useSetExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  SpanTagsProvider,
  useSpanTags,
} from 'sentry/views/explore/contexts/spanTagsContext';
import {useAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useExploreAggregatesTable} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import {useExploreSpansTable} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {useExploreTimeseries} from 'sentry/views/explore/hooks/useExploreTimeseries';
import {useExploreTracesTable} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';
import {useVisitQuery} from 'sentry/views/explore/hooks/useVisitQuery';
import {ExploreSpansTour, ExploreSpansTourContext} from 'sentry/views/explore/spans/tour';
import {ExploreTables} from 'sentry/views/explore/tables';
import {ExploreToolbar} from 'sentry/views/explore/toolbar';
import {
  combineConfidenceForSeries,
  type DefaultPeriod,
  type MaxPickableDays,
} from 'sentry/views/explore/utils';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {Onboarding} from 'sentry/views/performance/onboarding';

// eslint-disable-next-line no-restricted-imports
import QuotaExceededAlert from 'getsentry/components/performance/quotaExceededAlert';

type SpanTabProps = {
  defaultPeriod: DefaultPeriod;
  maxPickableDays: MaxPickableDays;
  relativeOptions: Record<string, React.ReactNode>;
};

function SpansTabContentImpl({
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: SpanTabProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const mode = useExploreMode();
  const visualizes = useExploreVisualizes();
  const setVisualizes = useSetExploreVisualizes();
  const fields = useExploreFields();
  const [samplesTab, setSamplesTab] = useTab();

  const {tags: numberTags, isLoading: numberTagsLoading} = useSpanTags('number');
  const {tags: stringTags, isLoading: stringTagsLoading} = useSpanTags('string');

  const query = useExploreQuery();
  const setExplorePageParams = useSetExplorePageParams();

  const id = useExploreId();
  const visitQuery = useVisitQuery();
  useEffect(() => {
    if (defined(id)) {
      visitQuery(id);
    }
  }, [id, visitQuery]);

  const toolbarExtras = [
    ...(organization?.features?.includes('visibility-explore-equations')
      ? ['equations' as const]
      : []),
    ...(organization?.features?.includes('visibility-explore-tabs')
      ? ['tabs' as const]
      : []),
  ];

  const queryType: 'aggregate' | 'samples' | 'traces' =
    mode === Mode.AGGREGATE
      ? 'aggregate'
      : samplesTab === Tab.TRACE
        ? 'traces'
        : 'samples';

  const limit = 25;

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
        const dedupedYAxes = dedupeArray(visualize.yAxes);
        const series = dedupedYAxes
          .flatMap(yAxis => timeseriesResult.data[yAxis])
          .filter(defined);
        return combineConfidenceForSeries(series);
      }),
    [timeseriesResult.data, visualizes]
  );

  const [expanded, setExpanded] = useState(true);
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

  const tableIsProgressivelyLoading =
    organization.features.includes('visibility-explore-progressive-loading') &&
    (queryType === 'samples'
      ? false // Samples mode won't show the progressive loading spinner
      : queryType === 'aggregate'
        ? // Only show the progressive spinner after the preflight query has been run
          aggregatesTableResult.samplingMode === SAMPLING_MODE.PREFLIGHT &&
          aggregatesTableResult.result.isFetched
        : false);

  const eapSpanSearchQueryBuilderProps = {
    projects: selection.projects,
    initialQuery: query,
    onSearch: (newQuery: string) => {
      const newFields = new MutableSearch(newQuery)
        .getFilterKeys()
        .map(key => (key.startsWith('!') ? key.slice(1) : key))
        // don't add aggregate functions to table fields
        .filter(key => !isAggregateField(key));
      setExplorePageParams({
        query: newQuery,
        fields: [...new Set([...fields, ...newFields])],
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
  };

  const eapSpanSearchQueryProviderProps = useEAPSpanSearchQueryBuilderProps(
    eapSpanSearchQueryBuilderProps
  );

  return (
    <SearchQueryBuilderProvider {...eapSpanSearchQueryProviderProps}>
      <Body withToolbar={expanded}>
        <TopSection>
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
                <DatePageFilter
                  defaultPeriod={defaultPeriod}
                  maxPickableDays={maxPickableDays}
                  relativeOptions={({arbitraryOptions}) => ({
                    ...arbitraryOptions,
                    ...relativeOptions,
                  })}
                />
              </StyledPageFilterBar>
              <EAPSpanSearchQueryBuilder {...eapSpanSearchQueryBuilderProps} />
            </FilterSection>
            <Feature features="organizations:traces-schema-hints">
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
            </Feature>
          </TourElement>
        </TopSection>
        <SideSection withToolbar={expanded}>
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
            <ExploreToolbar width={300} extras={toolbarExtras} />
          </TourElement>
        </SideSection>
        <MainContent>
          {!resultsLoading && !hasResults && <QuotaExceededAlert referrer="explore" />}
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
            <div>
              <ExploreCharts
                canUsePreviousResults={canUsePreviousResults}
                confidences={confidences}
                query={query}
                timeseriesResult={timeseriesResult}
                visualizes={visualizes}
                setVisualizes={setVisualizes}
                samplingMode={timeseriesSamplingMode}
                dataset={DiscoverDatasets.SPANS_EAP}
              />
              <ExploreTables
                aggregatesTableResult={aggregatesTableResult}
                spansTableResult={spansTableResult}
                tracesTableResult={tracesTableResult}
                confidences={confidences}
                samplesTab={samplesTab}
                setSamplesTab={setSamplesTab}
                isProgressivelyLoading={tableIsProgressivelyLoading}
                useTabs={organization.features.includes('visibility-explore-tabs')}
              />
              <Toggle>
                <StyledButton
                  aria-label={expanded ? t('Collapse sidebar') : t('Expand sidebar')}
                  size="xs"
                  icon={<IconDoubleChevron direction={expanded ? 'left' : 'right'} />}
                  onClick={() => setExpanded(!expanded)}
                />
              </Toggle>
            </div>
          </TourElement>
        </MainContent>
      </Body>
    </SearchQueryBuilderProvider>
  );
}

function IconDoubleChevron(props: React.ComponentProps<typeof IconChevron>) {
  return (
    <DoubleChevronWrapper>
      <IconChevron style={{marginRight: `-3px`}} {...props} />
      <IconChevron style={{marginLeft: `-3px`}} {...props} />
    </DoubleChevronWrapper>
  );
}

function ExploreTagsProvider({children}: any) {
  const dataset = useExploreDataset();

  return (
    <SpanTagsProvider dataset={dataset} enabled>
      {children}
    </SpanTagsProvider>
  );
}

type OnboardingContentProps = SpanTabProps & {onboardingProject: Project};

function OnboardingContent(props: OnboardingContentProps) {
  const organization = useOrganization();

  return (
    <Layout.Body>
      <TopSection>
        <FilterSection>
          <StyledPageFilterBar condensed>
            <ProjectPageFilter />
            <EnvironmentPageFilter />
            <DatePageFilter
              defaultPeriod={props.defaultPeriod}
              maxPickableDays={props.maxPickableDays}
              relativeOptions={({arbitraryOptions}) => ({
                ...arbitraryOptions,
                ...props.relativeOptions,
              })}
            />
          </StyledPageFilterBar>
        </FilterSection>
      </TopSection>
      <OnboardingContentSection>
        <Onboarding project={props.onboardingProject} organization={organization} />
      </OnboardingContentSection>
    </Layout.Body>
  );
}

export function SpansTabContent(props: SpanTabProps) {
  Sentry.setTag('explore.visited', 'yes');
  const onboardingProject = useOnboardingProject();
  const showOnboarding = onboardingProject !== undefined;

  return (
    <PageParamsProvider>
      <ExploreTagsProvider>
        {showOnboarding ? (
          <OnboardingContent {...props} onboardingProject={onboardingProject} />
        ) : (
          <SpansTabContentImpl {...props} />
        )}
      </ExploreTagsProvider>
    </PageParamsProvider>
  );
}

function checkIsAllowedSelection(
  selection: PageFilters,
  maxPickableDays: MaxPickableDays
) {
  const maxPickableMinutes = maxPickableDays * 24 * 60;
  const selectedMinutes = getDiffInMinutes(selection.datetime);
  return selectedMinutes <= maxPickableMinutes;
}

const transitionDuration = '200ms';

const Body = styled(Layout.Body)<{withToolbar: boolean}>`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    display: grid;
    ${p =>
      p.withToolbar
        ? `grid-template-columns: 300px minmax(100px, auto);`
        : `grid-template-columns: 0px minmax(100px, auto);`}
    grid-template-rows: auto 1fr;
    align-content: start;
    gap: ${space(2)} ${p => (p.withToolbar ? `${space(2)}` : '0px')};
    will-change: grid-template;
    transition: grid-template ${transitionDuration} cubic-bezier(0.22, 1, 0.36, 1);
  }
`;

const TopSection = styled('div')`
  grid-column: 1/3;
`;

const FilterSection = styled('div')`
  display: grid;
  gap: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: minmax(300px, auto) 1fr;
  }
`;

const SideSection = styled('aside')<{withToolbar: boolean}>`
  position: relative;
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    ${p =>
      p.withToolbar
        ? css`
            animation: toolbar-slide-in 0s forwards ${transitionDuration};

            @keyframes toolbar-slide-in {
              from {
                overflow: hidden;
              }
              to {
                overflow: visible;
              }
            }
          `
        : css`
            overflow: hidden;
          `}
  }
`;

const MainContent = styled('section')`
  position: relative;
  max-width: 100%;
  background: ${p => p.theme.background};
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  width: auto;
`;

const OnboardingContentSection = styled('section')`
  grid-column: 1/3;
`;

const Toggle = styled('div')`
  display: none;
  position: absolute;
  top: 0px;

  z-index: 1; /* place above loading mask */

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    display: block;
  }
`;

const StyledButton = styled(Button)`
  width: 28px;
  border-left: 0px;
  border-top-left-radius: 0px;
  border-bottom-left-radius: 0px;
`;

const DoubleChevronWrapper = styled('div')`
  display: flex;
`;

const StyledSchemaHintsSection = styled(SchemaHintsSection)`
  margin-top: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin-top: ${space(1)};
  }
`;
