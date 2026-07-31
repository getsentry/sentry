import {Fragment} from 'react';
import {closestCenter, DndContext} from '@dnd-kit/core';
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';

import * as Layout from 'sentry/components/layouts/thirds';
import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {AiQueryProvider} from 'sentry/components/searchQueryBuilder/askSeerCombobox/aiQueryContext';
import {t} from 'sentry/locale';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {
  ExploreBodyContent,
  ExploreBodySearch,
  ExploreContentSection,
} from 'sentry/views/explore/components/styles';
import {ToolbarVisualizeAddChart} from 'sentry/views/explore/components/toolbar/toolbarVisualize';
import {useMetricsAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {MAX_METRIC_ALLOWED_LABEL_VALUE} from 'sentry/views/explore/metrics/constants';
import {useEquationReferencedLabels} from 'sentry/views/explore/metrics/hooks/useEquationReferencedLabels';
import {useMetricReferences} from 'sentry/views/explore/metrics/hooks/useMetricReferences';
import {useSortableMetricQueries} from 'sentry/views/explore/metrics/hooks/useSortableMetricQueries';
import {SortableMetricPanel} from 'sentry/views/explore/metrics/metricPanel/sortableMetricPanel';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MetricSaveAs} from 'sentry/views/explore/metrics/metricToolbar/metricSaveAs';
import {
  MAX_METRICS_ALLOWED,
  useAddMetricQuery,
  useMultiMetricsQueryParams,
} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {
  FilterBarWithSaveAsContainer,
  StyledPageFilterBar,
} from 'sentry/views/explore/metrics/styles';
import {isVisualizeEquation} from 'sentry/views/explore/queryParams/visualize';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';
export const METRICS_CHART_GROUP = 'metrics-charts-group';

type MetricsTabProps = {
  datePageFilterProps: DatePageFilterProps;
};

function MetricsTabContentInner({datePageFilterProps}: MetricsTabProps) {
  const {referencedMetricLabels, onEquationLabelsChange} = useEquationReferencedLabels();

  return (
    <Fragment>
      <MetricsTabFilterSection datePageFilterProps={datePageFilterProps} />
      <ExploreBodyContent>
        <MetricsTabBodySection
          referencedMetricLabels={referencedMetricLabels}
          onEquationLabelsChange={onEquationLabelsChange}
        />
      </ExploreBodyContent>
    </Fragment>
  );
}

function MetricsTabFilterSection({datePageFilterProps}: MetricsTabProps) {
  const metricQueries = useMultiMetricsQueryParams();
  const addMetricQuery = useAddMetricQuery();
  const addEquationQuery = useAddMetricQuery({type: 'equation'});

  // Cannot add metric queries beyond Z
  const isAddMetricDisabled =
    metricQueries.length >= MAX_METRICS_ALLOWED ||
    metricQueries.some(q => q.label === MAX_METRIC_ALLOWED_LABEL_VALUE);

  return (
    <ExploreBodySearch>
      <Layout.Main width="full">
        <FilterBarWithSaveAsContainer>
          <StyledPageFilterBar condensed>
            <ProjectPageFilter />
            <EnvironmentPageFilter />
            <DatePageFilter
              {...datePageFilterProps}
              searchPlaceholder={t('Custom range: 2h, 4d, 3w')}
            />
          </StyledPageFilterBar>
          <Flex gap="sm" align="center">
            <ToolbarVisualizeAddChart
              add={addMetricQuery}
              disabled={isAddMetricDisabled}
              label={t('Add Metric')}
              display="button"
            />
            <ToolbarVisualizeAddChart
              display="button"
              add={addEquationQuery}
              disabled={metricQueries.length >= MAX_METRICS_ALLOWED}
              label={t('Add Equation')}
            />
            <MetricSaveAs size="md" />
          </Flex>
        </FilterBarWithSaveAsContainer>
      </Layout.Main>
    </ExploreBodySearch>
  );
}

interface SectionProps {
  onEquationLabelsChange: (equationLabel: string, labels: string[]) => void;
  referencedMetricLabels: Set<string>;
}

function MetricsTabBodySection({
  referencedMetricLabels,
  onEquationLabelsChange,
}: SectionProps) {
  const metricQueries = useMultiMetricsQueryParams();
  const [interval] = useChartInterval();
  const pageFilters = usePageFilters();
  const {isFetching: areToolbarsLoading, isMetricOptionsEmpty} = useMetricOptions({
    enabled: true,
  });

  useLLMContext({
    contextHint:
      'Sentry metrics explorer page. Users search and visualize application metrics (counters, gauges, distributions) with filters, grouping, and aggregation functions. You can search live telemetry for metrics, discover metric names via the telemetry index, and query metric data with specific filters and time ranges.',
    metricQueries: metricQueries.map(q => ({
      metric: q.metric?.name,
      label: q.label,
      query: q.queryParams.search.formatString(),
    })),
    interval,
    currentSelectedDateRange: pageFilters.selection.datetime,
  });

  useMetricsAnalytics({
    interval,
    metricQueries,
    areToolbarsLoading,
    isMetricOptionsEmpty,
  });
  const referenceMap = useMetricReferences(metricQueries);
  const aggregateMetricQueries = useSortableMetricQueries({
    predicate: metricQuery =>
      !isVisualizeEquation(metricQuery.queryParams.visualizes[0]!),
  });
  const equationMetricQueries = useSortableMetricQueries({
    predicate: metricQuery => isVisualizeEquation(metricQuery.queryParams.visualizes[0]!),
  });
  const isDragging =
    aggregateMetricQueries.isDragging || equationMetricQueries.isDragging;
  const showSectionSeparator =
    isDragging &&
    aggregateMetricQueries.sortableItems.length > 0 &&
    equationMetricQueries.sortableItems.length > 0;

  return (
    <ExploreContentSection>
      <Stack>
        <WidgetSyncContextProvider groupName={METRICS_CHART_GROUP}>
          <SortableMetricPanelSection
            dataTestId="aggregate-metric-panels"
            sortableQueries={aggregateMetricQueries}
            referenceMap={referenceMap}
            isAnyDragging={isDragging}
            referencedMetricLabels={referencedMetricLabels}
            onEquationLabelsChange={onEquationLabelsChange}
          />
          {showSectionSeparator ? (
            <Container paddingBottom="xl">
              <Separator
                orientation="horizontal"
                border="primary"
                data-test-id="metric-section-separator"
              />
            </Container>
          ) : null}
          <SortableMetricPanelSection
            dataTestId="equation-metric-panels"
            sortableQueries={equationMetricQueries}
            referenceMap={referenceMap}
            isAnyDragging={isDragging}
            referencedMetricLabels={referencedMetricLabels}
            onEquationLabelsChange={onEquationLabelsChange}
          />
        </WidgetSyncContextProvider>
      </Stack>
    </ExploreContentSection>
  );
}

interface SortableMetricPanelSectionProps {
  dataTestId: string;
  isAnyDragging: boolean;
  onEquationLabelsChange: (equationLabel: string, labels: string[]) => void;
  referenceMap: Record<string, string>;
  referencedMetricLabels: Set<string>;
  sortableQueries: ReturnType<typeof useSortableMetricQueries>;
}

function SortableMetricPanelSection({
  dataTestId,
  referencedMetricLabels,
  onEquationLabelsChange,
  sortableQueries,
  isAnyDragging,
  referenceMap,
}: SortableMetricPanelSectionProps) {
  const {sortableItems, sensors, onDragStart, onDragEnd, onDragCancel} = sortableQueries;

  if (!sortableItems.length) {
    return null;
  }

  return (
    <Stack data-test-id={dataTestId}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
          {sortableItems.map(({id, metricQuery, index}) => {
            return (
              <MetricsQueryParamsProvider
                key={id}
                queryParams={metricQuery.queryParams}
                setQueryParams={metricQuery.setQueryParams}
                traceMetric={metricQuery.metric}
                setTraceMetric={metricQuery.setTraceMetric}
                removeMetric={metricQuery.removeMetric}
              >
                <AiQueryProvider>
                  <SortableMetricPanel
                    referencedMetricLabels={referencedMetricLabels}
                    onEquationLabelsChange={onEquationLabelsChange}
                    sortableId={id}
                    traceMetric={metricQuery.metric}
                    queryIndex={index}
                    queryLabel={metricQuery.label ?? ''}
                    referenceMap={referenceMap}
                    isAnyDragging={isAnyDragging}
                    canDrag={sortableItems.length > 1}
                  />
                </AiQueryProvider>
              </MetricsQueryParamsProvider>
            );
          })}
        </SortableContext>
      </DndContext>
    </Stack>
  );
}

export const MetricsTabContent = registerLLMContext(
  'metrics-explorer',
  MetricsTabContentInner
);
