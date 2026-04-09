import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {OverChartButtonGroup} from 'sentry/views/explore/components/overChartButtonGroup';
import {
  ExploreBodyContent,
  ExploreBodySearch,
  ExploreContentSection,
  ExploreControlSection,
} from 'sentry/views/explore/components/styles';
import {ToolbarVisualizeAddChart} from 'sentry/views/explore/components/toolbar/toolbarVisualize';
import {useMetricsAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useControlSectionExpanded} from 'sentry/views/explore/hooks/useControlSectionExpanded';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {MetricPanel} from 'sentry/views/explore/metrics/metricPanel';
import {canUseMetricsUIRefresh} from 'sentry/views/explore/metrics/metricsFlags';
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

const METRICS_TOOLBAR_STORAGE_KEY = 'explore-metrics-toolbar';

function MetricsTabContentRefreshLayout({datePageFilterProps}: MetricsTabProps) {
  const [controlSectionExpanded, setControlSectionExpanded] = useControlSectionExpanded(
    METRICS_TOOLBAR_STORAGE_KEY
  );

  return (
    <MultiMetricsQueryParamsProvider>
      <MetricsTabFilterSection datePageFilterProps={datePageFilterProps} />
      <ExploreBodyContent>
        <MetricsQueryBuilderSection controlSectionExpanded={controlSectionExpanded} />
        <MetricsTabBodySection
          controlSectionExpanded={controlSectionExpanded}
          setControlSectionExpanded={setControlSectionExpanded}
        />
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
          {canUseMetricsUIRefresh(organization) ? null : <MetricSaveAs />}
        </FilterBarWithSaveAsContainer>
      </Layout.Main>
    </ExploreBodySearch>
  );
}

type MetricsQueryBuilderSectionProps = {
  controlSectionExpanded?: boolean;
};

function MetricsQueryBuilderSection({
  controlSectionExpanded,
}: MetricsQueryBuilderSectionProps = {}) {
  const organization = useOrganization();
  const metricQueries = useMultiMetricsQueryParams();
  const addMetricQuery = useAddMetricQuery();

  if (canUseMetricsUIRefresh(organization)) {
    return (
      <ExploreControlSection expanded={controlSectionExpanded ?? true}>
        {controlSectionExpanded ? (
          <Flex direction="column" gap="lg" align="start" width="100%">
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
                  <Container width="100%">
                    <MetricToolbar traceMetric={metricQuery.metric} queryIndex={index} />
                  </Container>
                </MetricsQueryParamsProvider>
              );
            })}
            <ToolbarVisualizeAddChart
              display="button"
              add={addMetricQuery}
              disabled={metricQueries.length >= MAX_METRICS_ALLOWED}
              label={t('Add Metric')}
            />
            <MetricSaveAs />
          </Flex>
        ) : null}
      </ExploreControlSection>
    );
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

type MetricsTabBodySectionProps = {
  controlSectionExpanded?: boolean;
  setControlSectionExpanded?: (expanded: boolean) => void;
};

function MetricsTabBodySection({
  controlSectionExpanded,
  setControlSectionExpanded,
}: MetricsTabBodySectionProps = {}) {
  const organization = useOrganization();
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

  if (canUseMetricsUIRefresh(organization)) {
    return (
      <ExploreContentSection>
        <OverChartButtonGroup>
          <MetricsToolbarChevronButton
            aria-label={
              controlSectionExpanded ? t('Collapse sidebar') : t('Expand sidebar')
            }
            expanded={controlSectionExpanded ?? true}
            size="xs"
            icon={
              <IconChevron
                isDouble
                direction={controlSectionExpanded ? 'left' : 'right'}
                size="xs"
              />
            }
            onClick={() => setControlSectionExpanded?.(!(controlSectionExpanded ?? true))}
          >
            {controlSectionExpanded ? null : t('Advanced')}
          </MetricsToolbarChevronButton>
        </OverChartButtonGroup>
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

const MetricsToolbarChevronButton = styled(Button)<{expanded: boolean}>`
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
