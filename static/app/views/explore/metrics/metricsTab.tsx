import {Fragment, useState} from 'react';
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
import {type TraceMetric} from 'sentry/views/explore/metrics/traceMetric';
import type {PickableDays} from 'sentry/views/explore/utils';

type LogsTabProps = PickableDays;

export function MetricsTabContent({
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: LogsTabProps) {
  return (
    <Fragment>
      <MetricsTabFilterSection
        defaultPeriod={defaultPeriod}
        maxPickableDays={maxPickableDays}
        relativeOptions={relativeOptions}
      />
      <MetricsTabBodySection />
    </Fragment>
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
  const [traceMetrics, setTraceMetrics] = useState<TraceMetric[]>([
    {name: 'myfirstmetric'},
    {name: 'mysecondmetric'},
  ]);

  return (
    <BottomSectionBody>
      <Flex direction="column" gap="lg">
        {traceMetrics.map((traceMetric, index) => {
          return (
            // TODO: figure out a better `key`
            <MetricsQueryParamsProvider key={index}>
              <MetricPanel traceMetric={traceMetric} />
            </MetricsQueryParamsProvider>
          );
        })}
        <AddMetricButtonContainer>
          <Button
            size="sm"
            priority="default"
            icon={<IconAdd />}
            onClick={() => {
              setTraceMetrics([
                ...traceMetrics,
                {name: `metric${traceMetrics.length + 1}`},
              ]);
            }}
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
