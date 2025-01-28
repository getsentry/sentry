import {useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import Alert from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {
  EAPSpanSearchQueryBuilder,
  SpanSearchQueryBuilder,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  type AggregationKey,
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
} from 'sentry/utils/fields';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ExploreCharts} from 'sentry/views/explore/charts';
import {
  PageParamsProvider,
  useExploreDataset,
  useExploreMode,
  useExploreQuery,
  useExploreVisualizes,
  useSetExploreQuery,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  SpanTagsProvider,
  useSpanTags,
} from 'sentry/views/explore/contexts/spanTagsContext';
import {useAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useExploreAggregatesTable} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import {useExploreSpansTable} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {useExploreTimeseries} from 'sentry/views/explore/hooks/useExploreTimeseries';
import {useExploreTracesTable} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';
import {ExploreTables} from 'sentry/views/explore/tables';
import {ExploreToolbar} from 'sentry/views/explore/toolbar';
import {
  combineConfidenceForSeries,
  type DefaultPeriod,
  type MaxPickableDays,
} from 'sentry/views/explore/utils';

export type SpanTabProps = {
  defaultPeriod: DefaultPeriod;
  maxPickableDays: MaxPickableDays;
  relativeOptions: Record<string, React.ReactNode>;
};

export function SpansTabContentImpl({
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: SpanTabProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const dataset = useExploreDataset();
  const mode = useExploreMode();
  const visualizes = useExploreVisualizes();
  const [samplesTab, setSamplesTab] = useTab();

  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

  const query = useExploreQuery();
  const setQuery = useSetExploreQuery();

  const toolbarExtras = organization?.features?.includes('visibility-explore-dataset')
    ? ['dataset toggle' as const]
    : [];

  const queryType: 'aggregate' | 'samples' | 'traces' =
    mode === Mode.AGGREGATE
      ? 'aggregate'
      : samplesTab === Tab.TRACE
        ? 'traces'
        : 'samples';

  const limit = 25;

  const aggregatesTableResult = useExploreAggregatesTable({
    query,
    limit,
    enabled: queryType === 'aggregate',
  });
  const spansTableResult = useExploreSpansTable({
    query,
    limit,
    enabled: queryType === 'samples',
  });
  const tracesTableResult = useExploreTracesTable({
    query,
    limit,
    enabled: queryType === 'traces',
  });
  const {timeseriesResult, canUsePreviousResults} = useExploreTimeseries({query});
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

  const tableError =
    queryType === 'aggregate'
      ? aggregatesTableResult.result.error?.message ?? ''
      : queryType === 'traces'
        ? tracesTableResult.result.error?.message ?? ''
        : spansTableResult.result.error?.message ?? '';
  const chartError = timeseriesResult.error?.message ?? '';

  useAnalytics({
    queryType,
    aggregatesTableResult,
    spansTableResult,
    tracesTableResult,
    timeseriesResult,
  });

  return (
    <Body>
      <TopSection>
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
        {dataset === DiscoverDatasets.SPANS_INDEXED ? (
          <SpanSearchQueryBuilder
            projects={selection.projects}
            initialQuery={query}
            onSearch={setQuery}
            searchSource="explore"
          />
        ) : (
          <EAPSpanSearchQueryBuilder
            projects={selection.projects}
            initialQuery={query}
            onSearch={setQuery}
            searchSource="explore"
            getFilterTokenWarning={
              mode === Mode.SAMPLES
                ? key => {
                    if (
                      ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.includes(key as AggregationKey)
                    ) {
                      return t(
                        "This key won't affect the results because samples mode does not support aggregate functions"
                      );
                    }
                    return undefined;
                  }
                : undefined
            }
            supportedAggregates={
              mode === Mode.SAMPLES ? [] : ALLOWED_EXPLORE_VISUALIZE_AGGREGATES
            }
            numberTags={numberTags}
            stringTags={stringTags}
          />
        )}
      </TopSection>
      <ExploreToolbar extras={toolbarExtras} />
      <MainSection fullWidth>
        {(tableError || chartError) && (
          <Alert type="error" showIcon>
            {tableError || chartError}
          </Alert>
        )}
        <ExploreCharts
          canUsePreviousResults={canUsePreviousResults}
          confidences={confidences}
          query={query}
          timeseriesResult={timeseriesResult}
        />
        <ExploreTables
          aggregatesTableResult={aggregatesTableResult}
          spansTableResult={spansTableResult}
          tracesTableResult={tracesTableResult}
          confidences={confidences}
          samplesTab={samplesTab}
          setSamplesTab={setSamplesTab}
        />
      </MainSection>
    </Body>
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

export function SpansTabContent(props: SpanTabProps) {
  Sentry.setTag('explore.visited', 'yes');

  return (
    <PageParamsProvider>
      <ExploreTagsProvider>
        <SpansTabContentImpl {...props} />
      </ExploreTagsProvider>
    </PageParamsProvider>
  );
}

const Body = styled(Layout.Body)`
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 300px minmax(100px, auto);
    gap: ${space(2)};
  }

  @media (min-width: ${p => p.theme.breakpoints.xxlarge}) {
    grid-template-columns: 400px minmax(100px, auto);
  }
`;

const TopSection = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-column: 1/3;
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(300px, auto) 1fr;
    margin-bottom: 0;
  }

  @media (min-width: ${p => p.theme.breakpoints.xxlarge}) {
    grid-template-columns: minmax(400px, auto) 1fr;
  }
`;

const MainSection = styled(Layout.Main)`
  grid-column: 2/3;
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  width: auto;
`;
