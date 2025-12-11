import styled from '@emotion/styled';

import {Container, Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {
  ExploreBodyContent,
  ExploreBodySearch,
  ExploreContentSection,
  ExploreControlSection,
} from 'sentry/views/explore/components/styles';
import {ToolbarVisualizeAddChart} from 'sentry/views/explore/components/toolbar/toolbarVisualize';
import {useMetricsAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {MetricPanel} from 'sentry/views/explore/metrics/metricPanel';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MetricToolbar} from 'sentry/views/explore/metrics/metricToolbar';
import {MetricSaveAs} from 'sentry/views/explore/metrics/metricToolbar/metricSaveAs';
import {
  MultiMetricsQueryParamsProvider,
  useAddMetricQuery,
  useMultiMetricsQueryParams,
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
              <MetricToolbar traceMetric={metricQuery.metric} queryIndex={index} />
            </MetricsQueryParamsProvider>
          );
        })}
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
      <ExploreControlSection expanded={false} />
      <ExploreContentSection expanded={false}>
        <Flex direction="column" gap="lg">
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
        </Flex>
      </ExploreContentSection>
    </ExploreBodyContent>
  );
}

const MetricsQueryBuilderContainer = styled(Container)`
  padding: ${p => `${p.theme.space.xl} ${p.theme.space['3xl']}`};
  background-color: ${p => p.theme.tokens.background.primary};
  border-top: none;
  border-bottom: 1px solid ${p => p.theme.border};
`;
