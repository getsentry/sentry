import styled from '@emotion/styled';

import {Container, Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {ToolbarVisualizeAddChart} from 'sentry/views/explore/components/toolbar/toolbarVisualize';
import {
  BottomSectionBody,
  FilterBarContainer,
  StyledPageFilterBar,
  TopSectionBody,
} from 'sentry/views/explore/logs/styles';
import {MetricPanel} from 'sentry/views/explore/metrics/metricPanel';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MetricToolbar} from 'sentry/views/explore/metrics/metricToolbar';
import {
  MultiMetricsQueryParamsProvider,
  useAddMetricQuery,
  useMultiMetricsQueryParams,
} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import type {PickableDays} from 'sentry/views/explore/utils';

const MAX_METRICS_ALLOWED = 4;
export const METRICS_CHART_GROUP = 'metrics-charts-group';

type MetricsTabProps = PickableDays;

export function MetricsTabContent({
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: MetricsTabProps) {
  return (
    <MultiMetricsQueryParamsProvider>
      <MetricsTabFilterSection
        defaultPeriod={defaultPeriod}
        maxPickableDays={maxPickableDays}
        relativeOptions={relativeOptions}
      />
      <MetricsQueryBuilderSection />
      <MetricsTabBodySection />
    </MultiMetricsQueryParamsProvider>
  );
}

function MetricsTabFilterSection({
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: PickableDays) {
  return (
    <TopSectionBody noRowGap>
      <Layout.Main width="full">
        <FilterBarContainer>
          <StyledPageFilterBar condensed>
            <ProjectPageFilter />
            <EnvironmentPageFilter />
            <DatePageFilter
              defaultPeriod={defaultPeriod}
              maxPickableDays={maxPickableDays}
              relativeOptions={relativeOptions}
              searchPlaceholder={t('Custom range: 2h, 4d, 3w')}
            />
          </StyledPageFilterBar>
        </FilterBarContainer>
      </Layout.Main>
    </TopSectionBody>
  );
}

function MetricsQueryBuilderSection() {
  const metricQueries = useMultiMetricsQueryParams();
  const addMetricQuery = useAddMetricQuery();
  return (
    <MetricsQueryBuilderContainer borderTop="primary" padding="md" style={{flexGrow: 0}}>
      <Flex direction="column" gap="lg">
        {metricQueries.map((metricQuery, index) => {
          return (
            <MetricsQueryParamsProvider
              key={`queryBuilder-${index}`}
              queryParams={metricQuery.queryParams}
              setQueryParams={metricQuery.setQueryParams}
              setTraceMetric={metricQuery.setTraceMetric}
              removeMetric={metricQuery.removeMetric}
            >
              <MetricToolbar traceMetric={metricQuery.metric} queryIndex={index} />
            </MetricsQueryParamsProvider>
          );
        })}
        <div>
          <ToolbarVisualizeAddChart
            add={addMetricQuery}
            disabled={metricQueries.length >= MAX_METRICS_ALLOWED}
          />
        </div>
      </Flex>
    </MetricsQueryBuilderContainer>
  );
}

function MetricsTabBodySection() {
  const metricQueries = useMultiMetricsQueryParams();

  return (
    <BottomSectionBody>
      <Flex direction="column" gap="lg">
        <WidgetSyncContextProvider groupName={METRICS_CHART_GROUP}>
          {metricQueries.map((metricQuery, index) => {
            return (
              <MetricsQueryParamsProvider
                key={`queryPanel-${index}`}
                queryParams={metricQuery.queryParams}
                setQueryParams={metricQuery.setQueryParams}
                setTraceMetric={metricQuery.setTraceMetric}
                removeMetric={metricQuery.removeMetric}
              >
                <MetricPanel traceMetric={metricQuery.metric} queryIndex={index} />
              </MetricsQueryParamsProvider>
            );
          })}
        </WidgetSyncContextProvider>
      </Flex>
    </BottomSectionBody>
  );
}

const MetricsQueryBuilderContainer = styled(Container)`
  padding: ${p => `${p.theme.space.xl} ${p.theme.space['3xl']}`};
  background-color: ${p => p.theme.background};
`;
