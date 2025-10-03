import {Fragment, useMemo} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {
  BottomSectionBody,
  FilterBarContainer,
  StyledPageFilterBar,
  TopSectionBody,
} from 'sentry/views/explore/logs/styles';
import {MetricRow} from 'sentry/views/explore/metrics/metricRow';
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
  const traceMetrics: TraceMetric[] = useMemo(() => {
    return [{name: 'myfirstmetric'}, {name: 'mysecondmetric'}];
  }, []);

  return (
    <BottomSectionBody>
      {traceMetrics.map((traceMetric, index) => {
        return (
          // TODO: figure out a better `key`
          <MetricsQueryParamsProvider key={index}>
            <MetricRow traceMetric={traceMetric} />
          </MetricsQueryParamsProvider>
        );
      })}
    </BottomSectionBody>
  );
}
