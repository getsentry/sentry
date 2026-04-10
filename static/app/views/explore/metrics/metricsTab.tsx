import {useCallback, useRef, useState} from 'react';
import type {DragEndEvent} from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import {Container, Flex, Stack} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {t} from 'sentry/locale';
import {uniqueId} from 'sentry/utils/guid';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {
  ExploreBodyContent,
  ExploreBodySearch,
  ExploreContentSection,
} from 'sentry/views/explore/components/styles';
import {ToolbarVisualizeAddChart} from 'sentry/views/explore/components/toolbar/toolbarVisualize';
import {useMetricsAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {useMetricReferences} from 'sentry/views/explore/metrics/hooks/useMetricReferences';
import {MetricPanel} from 'sentry/views/explore/metrics/metricPanel';
import {SortableMetricPanel} from 'sentry/views/explore/metrics/metricPanel/sortableMetricPanel';
import {encodeMetricQueryParams} from 'sentry/views/explore/metrics/metricQuery';
import {
  canUseMetricsEquations,
  canUseMetricsUIRefresh,
} from 'sentry/views/explore/metrics/metricsFlags';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MetricToolbar} from 'sentry/views/explore/metrics/metricToolbar';
import {MetricSaveAs} from 'sentry/views/explore/metrics/metricToolbar/metricSaveAs';
import {
  MultiMetricsQueryParamsProvider,
  useAddMetricQuery,
  useMultiMetricsQueryParams,
  useReorderMetricQueries,
} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {
  FilterBarWithSaveAsContainer,
  StyledPageFilterBar,
} from 'sentry/views/explore/metrics/styles';

const MAX_METRICS_ALLOWED = 8;
export const METRICS_CHART_GROUP = 'metrics-charts-group';

type MetricsTabProps = {
  datePageFilterProps: DatePageFilterProps;
};

function MetricsTabContentRefreshLayout({datePageFilterProps}: MetricsTabProps) {
  return (
    <MultiMetricsQueryParamsProvider>
      <MetricsTabFilterSection datePageFilterProps={datePageFilterProps} />
      <ExploreBodyContent>
        <MetricsQueryBuilderSection />
        <MetricsTabBodySection />
      </ExploreBodyContent>
    </MultiMetricsQueryParamsProvider>
  );
}

export function MetricsTabContent({datePageFilterProps}: MetricsTabProps) {
  const organization = useOrganization();

  if (canUseMetricsUIRefresh(organization)) {
    return <MetricsTabContentRefreshLayout datePageFilterProps={datePageFilterProps} />;
  }

  return (
    <MultiMetricsQueryParamsProvider>
      <MetricsTabFilterSection datePageFilterProps={datePageFilterProps} />
      <MetricsQueryBuilderSection />
      <MetricsTabBodySection />
    </MultiMetricsQueryParamsProvider>
  );
}

function MetricsTabFilterSection({datePageFilterProps}: MetricsTabProps) {
  const organization = useOrganization();
  const metricQueries = useMultiMetricsQueryParams();
  const addMetricQuery = useAddMetricQuery();
  const addEquationQuery = useAddMetricQuery({type: 'equation'});
  const hasEquations = canUseMetricsEquations(organization);

  if (canUseMetricsUIRefresh(organization)) {
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
                disabled={metricQueries.length >= MAX_METRICS_ALLOWED}
                label={t('Add Metric')}
                display="button"
              />

              {hasEquations && (
                <ToolbarVisualizeAddChart
                  display="button"
                  add={addEquationQuery}
                  disabled={metricQueries.length >= MAX_METRICS_ALLOWED}
                  label={t('Add Equation')}
                />
              )}
              <MetricSaveAs size="md" />
            </Flex>
          </FilterBarWithSaveAsContainer>
        </Layout.Main>
      </ExploreBodySearch>
    );
  }

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
          <MetricSaveAs />
        </FilterBarWithSaveAsContainer>
      </Layout.Main>
    </ExploreBodySearch>
  );
}

function MetricsQueryBuilderSection() {
  const organization = useOrganization();
  const metricQueries = useMultiMetricsQueryParams();
  const addMetricQuery = useAddMetricQuery();
  const addEquationQuery = useAddMetricQuery({type: 'equation'});
  const hasEquations = canUseMetricsEquations(organization);
  const references = useMetricReferences();

  if (canUseMetricsUIRefresh(organization)) {
    return null;
  }

  return (
    <MetricsQueryBuilderContainer borderTop="primary" padding="md" style={{flexGrow: 0}}>
      <Flex direction="column" gap="lg" align="start">
        {metricQueries.map((metricQuery, index) => {
          return (
            <MetricsQueryParamsProvider
              key={`queryBuilder-${index}`}
              queryParams={metricQuery.queryParams}
              setQueryParams={metricQuery.setQueryParams}
              traceMetric={metricQuery.metric}
              setTraceMetric={metricQuery.setTraceMetric}
              removeMetric={metricQuery.removeMetric}
            >
              <MetricToolbar
                traceMetric={metricQuery.metric}
                queryIndex={index}
                references={references}
              />
            </MetricsQueryParamsProvider>
          );
        })}
        <Flex direction="row" gap="sm" align="center" minWidth={0} width="100%">
          <ToolbarVisualizeAddChart
            add={addMetricQuery}
            disabled={metricQueries.length >= MAX_METRICS_ALLOWED}
            label={t('Add Metric')}
          />
          {hasEquations && (
            <ToolbarVisualizeAddChart
              add={addEquationQuery}
              disabled={metricQueries.length >= MAX_METRICS_ALLOWED}
              label={t('Add Equation')}
            />
          )}
        </Flex>
      </Flex>
    </MetricsQueryBuilderContainer>
  );
}

function useSortableMetricQueries() {
  const metricQueries = useMultiMetricsQueryParams();
  const reorderMetricQueries = useReorderMetricQueries();
  const [isDragging, setIsDragging] = useState(false);

  // Map from encoded query identity → stable unique ID. This correctly
  // handles deletions and mid-list insertions (unlike an index-based array).
  const idMapRef = useRef<Map<string, string>>(new Map());
  const sortableItems = metricQueries.map((metricQuery, i) => {
    const key = encodeMetricQueryParams(metricQuery);
    let uid = idMapRef.current.get(key);
    if (!uid) {
      uid = uniqueId();
      idMapRef.current.set(key, uid);
    }
    return {id: i + 1, uniqueId: uid, metricQuery};
  });
  // Prune stale entries for queries that no longer exist.
  const activeKeys = new Set(
    sortableItems.map(item => encodeMetricQueryParams(item.metricQuery))
  );
  for (const key of idMapRef.current.keys()) {
    if (!activeKeys.has(key)) {
      idMapRef.current.delete(key);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setIsDragging(false);
      const {active, over} = event;
      if (active.id !== over?.id) {
        const oldIndex = sortableItems.findIndex(({id}) => id === active.id);
        const newIndex = sortableItems.findIndex(({id}) => id === over?.id);
        if (oldIndex < 0 || newIndex < 0) {
          return;
        }
        reorderMetricQueries(arrayMove([...metricQueries], oldIndex, newIndex));
      }
    },
    [sortableItems, metricQueries, reorderMetricQueries]
  );

  const onDragCancel = useCallback(() => {
    setIsDragging(false);
  }, []);

  return {sortableItems, sensors, onDragStart, onDragEnd, onDragCancel, isDragging};
}

function MetricsTabBodySection() {
  const organization = useOrganization();
  const metricQueries = useMultiMetricsQueryParams();
  const addMetricQuery = useAddMetricQuery();
  const [interval] = useChartInterval();
  const {isFetching: areToolbarsLoading, isMetricOptionsEmpty} = useMetricOptions({
    enabled: true,
  });
  const addEquationQuery = useAddMetricQuery({type: 'equation'});
  const hasEquations = canUseMetricsEquations(organization);
  useMetricsAnalytics({
    interval,
    metricQueries,
    areToolbarsLoading,
    isMetricOptionsEmpty,
  });
  const references = useMetricReferences();
  const {sortableItems, sensors, onDragStart, onDragEnd, onDragCancel, isDragging} =
    useSortableMetricQueries();

  if (canUseMetricsUIRefresh(organization)) {
    return (
      <ExploreContentSection>
        <Stack>
          <WidgetSyncContextProvider groupName={METRICS_CHART_GROUP}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragCancel={onDragCancel}
            >
              <SortableContext
                items={sortableItems}
                strategy={verticalListSortingStrategy}
              >
                {sortableItems.map(({id, uniqueId: uid, metricQuery}, index) => {
                  return (
                    <MetricsQueryParamsProvider
                      key={uid}
                      queryParams={metricQuery.queryParams}
                      setQueryParams={metricQuery.setQueryParams}
                      traceMetric={metricQuery.metric}
                      setTraceMetric={metricQuery.setTraceMetric}
                      removeMetric={metricQuery.removeMetric}
                    >
                      <SortableMetricPanel
                        sortableId={id}
                        traceMetric={metricQuery.metric}
                        queryIndex={index}
                        references={references}
                        isAnyDragging={isDragging}
                        canDrag={sortableItems.length > 1}
                      />
                    </MetricsQueryParamsProvider>
                  );
                })}
              </SortableContext>
            </DndContext>
            <Flex gap="sm" direction="row">
              <ToolbarVisualizeAddChart
                add={addMetricQuery}
                disabled={metricQueries.length >= MAX_METRICS_ALLOWED}
                label={t('Add Metric')}
                display="button"
              />
              {hasEquations && (
                <ToolbarVisualizeAddChart
                  display="button"
                  add={addEquationQuery}
                  disabled={metricQueries.length >= MAX_METRICS_ALLOWED}
                  label={t('Add Equation')}
                />
              )}
            </Flex>
          </WidgetSyncContextProvider>
        </Stack>
      </ExploreContentSection>
    );
  }

  return (
    <ExploreBodyContent>
      <ExploreContentSection>
        <Stack>
          <WidgetSyncContextProvider groupName={METRICS_CHART_GROUP}>
            {metricQueries.map((metricQuery, index) => {
              return (
                <MetricsQueryParamsProvider
                  key={`queryPanel-${index}`}
                  queryParams={metricQuery.queryParams}
                  setQueryParams={metricQuery.setQueryParams}
                  traceMetric={metricQuery.metric}
                  setTraceMetric={metricQuery.setTraceMetric}
                  removeMetric={metricQuery.removeMetric}
                >
                  <MetricPanel
                    traceMetric={metricQuery.metric}
                    queryIndex={index}
                    references={references}
                  />
                </MetricsQueryParamsProvider>
              );
            })}
          </WidgetSyncContextProvider>
        </Stack>
      </ExploreContentSection>
    </ExploreBodyContent>
  );
}

const MetricsQueryBuilderContainer = styled(Container)`
  padding: ${p => p.theme.space.xl};
  background-color: ${p => p.theme.tokens.background.primary};
  border-top: none;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;
