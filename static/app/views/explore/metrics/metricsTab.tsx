import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  BottomSectionBody,
  FilterBarContainer,
  StyledPageFilterBar,
  TopSectionBody,
} from 'sentry/views/explore/logs/styles';
import {MetricPanel} from 'sentry/views/explore/metrics/metricPanel';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {
  MultiMetricsQueryParamsProvider,
  useAddMetricQuery,
  useMultiMetricsQueryParams,
} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import type {PickableDays} from 'sentry/views/explore/utils';

type LogsTabProps = PickableDays;

export function MetricsTabContent({
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: LogsTabProps) {
  return (
    <MultiMetricsQueryParamsProvider>
      <MetricsTabFilterSection
        defaultPeriod={defaultPeriod}
        maxPickableDays={maxPickableDays}
        relativeOptions={relativeOptions}
      />
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
      <Layout.Main fullWidth>
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

function MetricsTabBodySection() {
  const metricQueries = useMultiMetricsQueryParams();
  const addMetricQuery = useAddMetricQuery();

  return (
    <BottomSectionBody>
      <Flex direction="column" gap="lg">
        {metricQueries.map((metricQuery, index) => {
          return (
            // TODO: figure out a better `key`
            <MetricsQueryParamsProvider
              key={index}
              queryParams={metricQuery.queryParams}
              setQueryParams={metricQuery.setQueryParams}
              setMetricName={metricQuery.setMetricName}
            >
              <MetricPanel traceMetric={metricQuery.metric} />
            </MetricsQueryParamsProvider>
          );
        })}
        <AddMetricButtonContainer>
          <Button
            size="sm"
            priority="default"
            icon={<IconAdd />}
            onClick={addMetricQuery}
          >
            {t('Add Metric')}
          </Button>
        </AddMetricButtonContainer>
      </Flex>
    </BottomSectionBody>
  );
}

const AddMetricButtonContainer = styled('div')`
  button {
    width: 100%;
  }
`;
