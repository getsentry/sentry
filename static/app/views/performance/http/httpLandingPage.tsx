import React, {Fragment} from 'react';
import styled from '@emotion/styled';
import pickBy from 'lodash/pickBy';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {fromSorts} from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import {DurationChart} from 'sentry/views/performance/database/durationChart';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';
import {DomainsTable, isAValidSort} from 'sentry/views/performance/http/domainsTable';
import {ThroughputChart} from 'sentry/views/performance/http/throughputChart';
import Onboarding from 'sentry/views/performance/onboarding';
import {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {ModuleName} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

export function HTTPLandingPage() {
  const organization = useOrganization();
  const location = useLocation();
  const onboardingProject = useOnboardingProject();

  const sortField = decodeScalar(location.query?.[QueryParameterNames.DOMAINS_SORT]);

  const sort = fromSorts(sortField).filter(isAValidSort).at(0) ?? DEFAULT_SORT;

  const chartFilters = {
    'span.module': ModuleName.HTTP,
    has: 'span.domain',
  };

  const tableFilters = {
    'span.module': ModuleName.HTTP,
    has: 'span.domain',
  };

  const cursor = decodeScalar(location.query?.[QueryParameterNames.DOMAINS_CURSOR]);

  const {isLoading: isThroughputDataLoading, data: throughputData} = useSpanMetricsSeries(
    {
      filters: chartFilters,
      yAxis: ['spm()'],
      referrer: 'api.starfish.http-module-landing-throughput-chart',
    }
  );

  const {isLoading: isDurationDataLoading, data: durationData} = useSpanMetricsSeries({
    filters: chartFilters,
    yAxis: [`avg(span.self_time)`],
    referrer: 'api.starfish.http-module-landing-duration-chart',
  });

  const domainsListResponse = useSpanMetrics({
    filters: pickBy(tableFilters, value => value !== undefined),
    fields: [
      'project.id',
      'span.domain',
      'spm()',
      'avg(span.self_time)',
      'sum(span.self_time)',
      'time_spent_percentage()',
    ],
    sorts: [sort],
    limit: LIMIT,
    cursor,
    referrer: 'api.starfish.http-module-domains-list',
  });

  useSynchronizeCharts([!isThroughputDataLoading && !isDurationDataLoading]);

  return (
    <React.Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: t('Performance'),
                to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
                preservePageFilters: true,
              },
              {
                label: t('HTTP'),
              },
            ]}
          />

          <Layout.Title>{t('HTTP')}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <FloatingFeedbackWidget />

          <PaddedContainer>
            <PageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter />
            </PageFilterBar>
          </PaddedContainer>

          {onboardingProject && (
            <Onboarding organization={organization} project={onboardingProject} />
          )}
          {!onboardingProject && (
            <Fragment>
              <ChartContainer>
                <ThroughputChart
                  series={throughputData['spm()']}
                  isLoading={isThroughputDataLoading}
                />

                <DurationChart
                  series={durationData[`avg(span.self_time)`]}
                  isLoading={isDurationDataLoading}
                />
              </ChartContainer>

              <DomainsTable response={domainsListResponse} sort={sort} />
            </Fragment>
          )}
        </Layout.Main>
      </Layout.Body>
    </React.Fragment>
  );
}

const DEFAULT_SORT = {
  field: 'time_spent_percentage()' as const,
  kind: 'desc' as const,
};

const PaddedContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

const ChartContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr 1fr;
    gap: ${space(2)};
  }
`;

const LIMIT = 10;

function LandingPageWithProviders() {
  return (
    <ModulePageProviders title={[t('Performance'), t('HTTP')].join(' — ')}>
      <HTTPLandingPage />
    </ModulePageProviders>
  );
}

export default LandingPageWithProviders;
