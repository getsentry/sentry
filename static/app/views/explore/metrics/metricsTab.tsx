import {Fragment} from 'react';
import {closestCenter, DndContext} from '@dnd-kit/core';
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';

import * as Layout from 'sentry/components/layouts/thirds';
import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {t} from 'sentry/locale';
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
import {useEquationReferencedLabels} from 'sentry/views/explore/metrics/hooks/useEquationReferencedLabels';
import {useMetricReferences} from 'sentry/views/explore/metrics/hooks/useMetricReferences';
import {useSortableMetricQueries} from 'sentry/views/explore/metrics/hooks/useSortableMetricQueries';
import {MetricPanel} from 'sentry/views/explore/metrics/metricPanel';
import {SortableMetricPanel} from 'sentry/views/explore/metrics/metricPanel/sortableMetricPanel';
import {
  canUseMetricsEquations,
  canUseMetricsUIRefresh,
} from 'sentry/views/explore/metrics/metricsFlags';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MetricToolbar} from 'sentry/views/explore/metrics/metricToolbar';
import {MetricSaveAs} from 'sentry/views/explore/metrics/metricToolbar/metricSaveAs';
import {
  MAX_METRICS_ALLOWED,
  MultiMetricsQueryParamsProvider,
  useAddMetricQuery,
  useMultiMetricsQueryParams,
} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {
  FilterBarWithSaveAsContainer,
  StyledPageFilterBar,
} from 'sentry/views/explore/metrics/styles';
import {isVisualizeEquation} from 'sentry/views/explore/queryParams/visualize';
export const METRICS_CHART_GROUP = 'metrics-charts-group';

type MetricsTabProps = {
  datePageFilterProps: DatePageFilterProps;
};

function MetricsTabContentRefreshLayout({datePageFilterProps}: MetricsTabProps) {
  const organization = useOrganization();
  const hasEquations = canUseMetricsEquations(organization);
  return (
    <MultiMetricsQueryParamsProvider hasEquations={hasEquations}>
      <MetricsTabContentRefreshInner datePageFilterProps={datePageFilterProps} />
    </MultiMetricsQueryParamsProvider>
  );
}

function MetricsTabContentRefreshInner({datePageFilterProps}: MetricsTabProps) {
  const {referencedMetricLabels, onEquationLabelsChange} = useEquationReferencedLabels();

  return (
    <Fragment>
      <MetricsTabFilterSection datePageFilterProps={datePageFilterProps} />
      <ExploreBodyContent>
        <MetricsQueryBuilderSection
          referencedMetricLabels={referencedMetricLabels}
          onEquationLabelsChange={onEquationLabelsChange}
        />
        <MetricsTabBodySection
          referencedMetricLabels={referencedMetricLabels}
          onEquationLabelsChange={onEquationLabelsChange}
        />
      </ExploreBodyContent>
    </Fragment>
  );
}

export function MetricsTabContent({datePageFilterProps}: MetricsTabProps) {
  const organization = useOrganization();

  if (canUseMetricsUIRefresh(organization)) {
    return <MetricsTabContentRefreshLayout datePageFilterProps={datePageFilterProps} />;
  }

  return <MetricsTabContentDefaultLayout datePageFilterProps={datePageFilterProps} />;
}

function MetricsTabContentDefaultLayout({datePageFilterProps}: MetricsTabProps) {
  const organization = useOrganization();
  const hasEquations = canUseMetricsEquations(organization);
  return (
    <MultiMetricsQueryParamsProvider hasEquations={hasEquations}>
      <MetricsTabContentDefaultInner datePageFilterProps={datePageFilterProps} />
    </MultiMetricsQueryParamsProvider>
  );
}

function MetricsTabContentDefaultInner({datePageFilterProps}: MetricsTabProps) {
  const {referencedMetricLabels, onEquationLabelsChange} = useEquationReferencedLabels();

  return (
    <Fragment>
      <MetricsTabFilterSection datePageFilterProps={datePageFilterProps} />
      <MetricsQueryBuilderSection
        referencedMetricLabels={referencedMetricLabels}
        onEquationLabelsChange={onEquationLabelsChange}
      />
      <MetricsTabBodySection
        referencedMetricLabels={referencedMetricLabels}
        onEquationLabelsChange={onEquationLabelsChange}
      />
    </Fragment>
  );
}

function MetricsTabFilterSection({datePageFilterProps}: MetricsTabProps) {
  const organization = useOrganization();
  const metricQueries = useMultiMetricsQueryParams();
  const addMetricQuery = useAddMetricQuery();
  const addEquationQuery = useAddMetricQuery({type: 'equation'});
  const hasEquations = canUseMetricsEquations(organization);

  // Cannot add metric queries beyond Z
  const isAddMetricDisabled =
    metricQueries.length >= MAX_METRICS_ALLOWED ||
    metricQueries.some(q => q.label === 'Z');

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
                disabled={isAddMetricDisabled}
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

interface SectionProps {
  onEquationLabelsChange: (equationLabel: string, labels: string[]) => void;
  referencedMetricLabels: Set<string>;
}

function MetricsQueryBuilderSection({
  referencedMetricLabels,
  onEquationLabelsChange,
}: SectionProps) {
  const organization = useOrganization();
  const metricQueries = useMultiMetricsQueryParams();
  const addMetricQuery = useAddMetricQuery();
  const addEquationQuery = useAddMetricQuery({type: 'equation'});
  const hasEquations = canUseMetricsEquations(organization);
  const referenceMap = useMetricReferences();

  if (canUseMetricsUIRefresh(organization)) {
    return null;
  }

  // Cannot add metric queries beyond Z
  const isAddMetricDisabled =
    metricQueries.length >= MAX_METRICS_ALLOWED ||
    metricQueries.some(q => q.label === 'Z');

  return (
    <MetricsQueryBuilderContainer borderTop="primary" padding="md" style={{flexGrow: 0}}>
      <Flex direction="column" gap="lg" align="start">
        {metricQueries.map((metricQuery, index) => {
          return (
            <MetricsQueryParamsProvider
              key={`queryBuilder-${metricQuery.label ?? index}`}
              queryParams={metricQuery.queryParams}
              setQueryParams={metricQuery.setQueryParams}
              traceMetric={metricQuery.metric}
              setTraceMetric={metricQuery.setTraceMetric}
              removeMetric={metricQuery.removeMetric}
            >
              <MetricToolbar
                traceMetric={metricQuery.metric}
                queryLabel={metricQuery.label ?? ''}
                referenceMap={referenceMap}
                referencedMetricLabels={referencedMetricLabels}
                onEquationLabelsChange={onEquationLabelsChange}
              />
            </MetricsQueryParamsProvider>
          );
        })}
        <Flex direction="row" gap="sm" align="center" minWidth={0} width="100%">
          <ToolbarVisualizeAddChart
            add={addMetricQuery}
            disabled={isAddMetricDisabled}
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

function MetricsTabBodySection({
  referencedMetricLabels,
  onEquationLabelsChange,
}: SectionProps) {
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
  const referenceMap = useMetricReferences();
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

  // Cannot add metric queries beyond Z
  const isAddMetricDisabled =
    metricQueries.length >= MAX_METRICS_ALLOWED ||
    metricQueries.some(q => q.label === 'Z');

  if (canUseMetricsUIRefresh(organization)) {
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
            <Flex gap="sm" direction="row">
              <ToolbarVisualizeAddChart
                add={addMetricQuery}
                disabled={isAddMetricDisabled}
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
                  key={`queryPanel-${metricQuery.label ?? index}`}
                  queryParams={metricQuery.queryParams}
                  setQueryParams={metricQuery.setQueryParams}
                  traceMetric={metricQuery.metric}
                  setTraceMetric={metricQuery.setTraceMetric}
                  removeMetric={metricQuery.removeMetric}
                >
                  <MetricPanel
                    traceMetric={metricQuery.metric}
                    queryIndex={index}
                    queryLabel={metricQuery.label ?? ''}
                    referenceMap={referenceMap}
                    referencedMetricLabels={referencedMetricLabels}
                    onEquationLabelsChange={onEquationLabelsChange}
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
              </MetricsQueryParamsProvider>
            );
          })}
        </SortableContext>
      </DndContext>
    </Stack>
  );
}

const MetricsQueryBuilderContainer = styled(Container)`
  padding: ${p => p.theme.space.xl};
  background-color: ${p => p.theme.tokens.background.primary};
  border-top: none;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;
