import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {
  EAPSpanSearchQueryBuilder,
  SpanSearchQueryBuilder,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  type AggregationKey,
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
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
import {useExploreAggregatesTable} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import {useExploreSpansTable} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {useExploreTimeseries} from 'sentry/views/explore/hooks/useExploreTimeseries';
import {useExploreTracesTable} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';
import {ExploreTables} from 'sentry/views/explore/tables';
import {ExploreToolbar} from 'sentry/views/explore/toolbar';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';

function ExploreContentImpl() {
  const location = useLocation();
  const navigate = useNavigate();
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

  const toolbarExtras = organization.features.includes('visibility-explore-dataset')
    ? ['dataset toggle' as const]
    : [];

  const switchToOldTraceExplorer = useCallback(() => {
    navigate({
      ...location,
      query: {
        ...location.query,
        view: 'trace',
      },
    });
  }, [location, navigate]);

  const maxPickableDays = 7;

  const queryType: 'aggregate' | 'samples' | 'traces' =
    mode === Mode.AGGREGATE
      ? 'aggregate'
      : samplesTab === Tab.TRACE
        ? 'traces'
        : 'samples';

  const aggregatesTableResult = useExploreAggregatesTable({
    query,
    enabled: queryType === 'aggregate',
  });
  const spansTableResult = useExploreSpansTable({
    query,
    enabled: queryType === 'samples',
  });
  const tracesTableResult = useExploreTracesTable({
    query,
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

  return (
    <SentryDocumentTitle title={t('Traces')} orgSlug={organization.slug}>
      <PageFiltersContainer maxPickableDays={maxPickableDays}>
        <Layout.Page>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>
                {t('Traces')}
                <PageHeadingQuestionTooltip
                  docsUrl="https://github.com/getsentry/sentry/discussions/81239"
                  title={t(
                    'Find problematic spans/traces or compute real-time metrics via aggregation.'
                  )}
                  linkLabel={t('Read the Discussion')}
                />
                <FeatureBadge
                  title={t(
                    'This feature is available for early adopters and the UX may change'
                  )}
                  type="beta"
                />
              </Layout.Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <ButtonBar gap={1}>
                <Feature organization={organization} features="visibility-explore-admin">
                  <Button onClick={switchToOldTraceExplorer} size="sm">
                    {t('Switch to Old Trace Explore')}
                  </Button>
                </Feature>
                <FeedbackWidgetButton />
              </ButtonBar>
            </Layout.HeaderActions>
          </Layout.Header>
          <Body>
            <TopSection>
              <StyledPageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
                <DatePageFilter
                  defaultPeriod="7d"
                  maxPickableDays={maxPickableDays}
                  relativeOptions={({arbitraryOptions}) => ({
                    ...arbitraryOptions,
                    '1h': t('Last 1 hour'),
                    '24h': t('Last 24 hours'),
                    '7d': t('Last 7 days'),
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
                            ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.includes(
                              key as AggregationKey
                            )
                          ) {
                            return t(
                              "This key won't affect the results because samples mode does not support aggregate functions"
                            );
                          }
                          return undefined;
                        }
                      : undefined
                  }
                  supportedAggregates={ALLOWED_EXPLORE_VISUALIZE_AGGREGATES}
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
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
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

export function ExploreContent() {
  Sentry.setTag('explore.visited', 'yes');

  return (
    <PageParamsProvider>
      <ExploreTagsProvider>
        <ExploreContentImpl />
      </ExploreTagsProvider>
    </PageParamsProvider>
  );
}

const Body = styled(Layout.Body)`
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 350px minmax(100px, auto);
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
    grid-template-columns: minmax(350px, auto) 1fr;
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
