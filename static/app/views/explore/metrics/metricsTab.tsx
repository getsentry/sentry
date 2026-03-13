import {useCallback, useRef} from 'react';
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
import {MetricPanel} from 'sentry/views/explore/metrics/metricPanel';
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

export function MetricsTabContent({datePageFilterProps}: MetricsTabProps) {
  return (
    <MultiMetricsQueryParamsProvider>
      <MetricsTabFilterSection datePageFilterProps={datePageFilterProps} />
      <MetricsQueryBuilderSection />
      <MetricsTabBodySection />
    </MultiMetricsQueryParamsProvider>
  );
}

function MetricsTabFilterSection({datePageFilterProps}: MetricsTabProps) {
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
  const metricQueries = useMultiMetricsQueryParams();
  const addMetricQuery = useAddMetricQuery();
  const reorderMetricQueries = useReorderMetricQueries();

  const dragIdsRef = useRef<number[]>([]);
  while (dragIdsRef.current.length < metricQueries.length) {
    dragIdsRef.current.push(dragIdsRef.current.length + 1);
  }
  dragIdsRef.current.length = metricQueries.length;
  const dragIds = dragIdsRef.current;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const {active, over} = event;
      if (active.id !== over?.id) {
        const oldIndex = dragIds.indexOf(active.id as number);
        const newIndex = dragIds.indexOf(over?.id as number);
        if (oldIndex >= 0 && newIndex >= 0) {
          const [removed] = dragIds.splice(oldIndex, 1);
          dragIds.splice(newIndex, 0, removed!);
          reorderMetricQueries(oldIndex, newIndex);
        }
      }
    },
    [dragIds, reorderMetricQueries]
  );

  return (
    <MetricsQueryBuilderContainer borderTop="primary" padding="md" style={{flexGrow: 0}}>
      <Flex direction="column" gap="lg" align="start">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={dragIds} strategy={verticalListSortingStrategy}>
            {metricQueries.map((metricQuery, index) => {
              return (
                <MetricsQueryParamsProvider
                  key={`queryBuilder-${dragIds[index]}`}
                  queryParams={metricQuery.queryParams}
                  setQueryParams={metricQuery.setQueryParams}
                  traceMetric={metricQuery.metric}
                  setTraceMetric={metricQuery.setTraceMetric}
                  removeMetric={metricQuery.removeMetric}
                >
                  <MetricToolbar
                    traceMetric={metricQuery.metric}
                    queryIndex={index}
                    dragId={dragIds[index]!}
                  />
                </MetricsQueryParamsProvider>
              );
            })}
          </SortableContext>
        </DndContext>
        <ToolbarVisualizeAddChart
          add={addMetricQuery}
          disabled={metricQueries.length >= MAX_METRICS_ALLOWED}
          label={t('Add Metric')}
        />
      </Flex>
    </MetricsQueryBuilderContainer>
  );
}

function MetricsTabBodySection() {
  const metricQueries = useMultiMetricsQueryParams();
  const [interval] = useChartInterval();
  const {isFetching: areToolbarsLoading, isMetricOptionsEmpty} = useMetricOptions({
    enabled: true,
  });
  useMetricsAnalytics({
    interval,
    metricQueries,
    areToolbarsLoading,
    isMetricOptionsEmpty,
  });

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
                  <MetricPanel traceMetric={metricQuery.metric} queryIndex={index} />
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
