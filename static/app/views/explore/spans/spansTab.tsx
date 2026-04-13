import {Fragment, useEffect, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {TourElement} from 'sentry/components/tours/components';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {parseError} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ChartSelectionProvider} from 'sentry/views/explore/components/attributeBreakdowns/chartSelectionContext';
import {OverChartButtonGroup} from 'sentry/views/explore/components/overChartButtonGroup';
import {
  ExploreBodyContent,
  ExploreBodySearch,
  ExploreContentSection,
  ExploreControlSection,
} from 'sentry/views/explore/components/styles';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useControlSectionExpanded} from 'sentry/views/explore/hooks/useControlSectionExpanded';
import {useCrossEventQueries} from 'sentry/views/explore/hooks/useCrossEventQueries';
import {useExploreAggregatesTable} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import {useExploreSpansTable} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {useExploreTimeseries} from 'sentry/views/explore/hooks/useExploreTimeseries';
import {
  type TracesTableResult,
  useExploreTracesTableApiOptions,
} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';
import {useVisitQuery} from 'sentry/views/explore/hooks/useVisitQuery';
import {
  useQueryParamsExtrapolate,
  useQueryParamsId,
  useQueryParamsQuery,
  useQueryParamsVisualizes,
  useSetQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {ExploreCharts} from 'sentry/views/explore/spans/charts';
import {DroppedFieldsAlert} from 'sentry/views/explore/spans/droppedFieldsAlert';
import {ExtrapolationEnabledAlert} from 'sentry/views/explore/spans/extrapolationEnabledAlert';
import {SettingsDropdown} from 'sentry/views/explore/spans/settingsDropdown';
import {SpansExport} from 'sentry/views/explore/spans/spansExport';
import {SpanTabSearchSection} from 'sentry/views/explore/spans/spansTabSearchSection';
import {ExploreSpansTour, ExploreSpansTourContext} from 'sentry/views/explore/spans/tour';
import {ExploreTables} from 'sentry/views/explore/tables';
import {ExploreToolbar} from 'sentry/views/explore/toolbar';
import {useRawCounts} from 'sentry/views/explore/useRawCounts';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';
import {Onboarding} from 'sentry/views/performance/onboarding';

// eslint-disable-next-line boundaries/dependencies
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

interface SpanTabProps {
  datePageFilterProps: DatePageFilterProps;
}

const SPANS_TOOLBAR_STORAGE_KEY = 'explore-spans-toolbar';

export function SpansTabContent({datePageFilterProps}: SpanTabProps) {
  useVisitExplore();

  const [controlSectionExpanded, setControlSectionExpanded] = useControlSectionExpanded(
    SPANS_TOOLBAR_STORAGE_KEY
  );

  return (
    <Fragment>
      <ChartSelectionProvider>
        <ExploreBodySearch>
          <SpanTabSearchSection datePageFilterProps={datePageFilterProps} />
        </ExploreBodySearch>
        <ExploreBodyContent>
          <SpanTabControlSection controlSectionExpanded={controlSectionExpanded} />
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

interface SpanTabControlSectionProps {
  controlSectionExpanded: boolean;
}

function SpanTabControlSection({controlSectionExpanded}: SpanTabControlSectionProps) {
  const toolbarExtras: Array<'equations'> = ['equations'];

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
        {tourProps => (
          <div {...tourProps}>
            {controlSectionExpanded && (
              <ExploreToolbar width={300} extras={toolbarExtras} />
            )}
          </div>
        )}
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
  const crossEventQueries = useCrossEventQueries();

  const organization = useOrganization();
  const hasCrossEventQueries = organization.features.includes(
    'traces-page-cross-event-querying'
  );

  const queryType =
    tab === Mode.AGGREGATE
      ? 'aggregate'
      : tab === Tab.TRACE
        ? 'traces'
        : tab === Tab.ATTRIBUTE_BREAKDOWNS
          ? 'attribute_breakdowns'
          : 'samples';

  const limit = 50;

  const rawSpanCounts = useRawCounts({dataset: DiscoverDatasets.SPANS});

  const aggregatesTableResult = useExploreAggregatesTable({
    query,
    limit,
    enabled: isReady && queryType === 'aggregate',
    queryExtras: {
      caseInsensitive,
      ...(hasCrossEventQueries && defined(crossEventQueries) ? crossEventQueries : {}),
    },
  });
  const spansTableResult = useExploreSpansTable({
    query,
    limit,
    enabled: isReady && queryType === 'samples',
    queryExtras: {
      caseInsensitive,
      ...(hasCrossEventQueries && defined(crossEventQueries) ? crossEventQueries : {}),
    },
  });
  const tracesTableQuery = useQuery({
    ...useExploreTracesTableApiOptions({
      query,
      limit,
      queryExtras: {
        caseInsensitive,
        ...(hasCrossEventQueries && defined(crossEventQueries) ? crossEventQueries : {}),
      },
    }),
    select: selectJsonWithHeaders,
    enabled: isReady && queryType === 'traces',
  });
  const tracesTableResult = {
    result: tracesTableQuery,
    error: parseError(tracesTableQuery.error),
  } satisfies TracesTableResult;

  const {result: timeseriesResult, samplingMode: timeseriesSamplingMode} =
    useExploreTimeseries({
      query,
      enabled: isReady,
      queryExtras: {
        caseInsensitive,
        ...(hasCrossEventQueries && defined(crossEventQueries) ? crossEventQueries : {}),
      },
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

  const error = defined(timeseriesResult.error)
    ? null // if the timeseries errors, we prefer to show that error in the chart
    : queryType === 'samples'
      ? spansTableResult.result.error
      : queryType === 'traces'
        ? tracesTableResult.error
        : queryType === 'aggregate'
          ? aggregatesTableResult.result.error
          : null;

  return (
    <ExploreContentSection>
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
        <Flex gap="xs">
          <SpansExport
            aggregatesTableResult={aggregatesTableResult}
            spansTableResult={spansTableResult}
          />
          <SettingsDropdown />
        </Flex>
      </OverChartButtonGroup>
      {defined(id) && <DroppedFieldsAlert />}
      <QuotaExceededAlert referrer="spans-explore" traceItemDataset="spans" />
      <ExtrapolationEnabledAlert />
      {defined(error) && (
        <Alert.Container>
          <Alert variant="danger">{error.message}</Alert>
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
        {props => (
          <div {...props}>
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
          </div>
        )}
      </TourElement>
    </ExploreContentSection>
  );
}

const OnboardingContentSection = styled('section')`
  grid-column: 1/3;
`;

export const ChevronButton = styled(Button)<{expanded: boolean}>`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    display: inline-flex;
  }

  ${p =>
    p.expanded &&
    css`
      margin-left: -17px;
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;

      &::after {
        border-left-color: ${p.theme.tokens.border.primary};
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
      }
    `}
`;
