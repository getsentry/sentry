import React from 'react';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {CacheHitMissChart} from 'sentry/views/performance/cache/charts/hitMissChart';
import {ThroughputChart} from 'sentry/views/performance/cache/charts/throughputChart';
import {Referrer} from 'sentry/views/performance/cache/referrers';
import {MODULE_TITLE, RELEASE_LEVEL} from 'sentry/views/performance/cache/settings';
import {convertHitRateToMissRate} from 'sentry/views/performance/cache/utils';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import type {SpanMetricsQueryFilters} from 'sentry/views/starfish/types';

export function CacheLandingPage() {
  const organization = useOrganization();

  const filters: SpanMetricsQueryFilters = {
    'span.module': 'cache',
  };

  const {
    isLoading: isCacheHitRateLoading,
    data: cacheHitRateData,
    error: cacheHitRateError,
  } = useSpanMetricsSeries({
    yAxis: [`cache_hit_rate()`],
    search: MutableSearch.fromQueryObject(filters),
    referrer: Referrer.LANDING_CACHE_HIT_MISS_CHART,
  });

  const {
    isLoading: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries({
    search: MutableSearch.fromQueryObject(filters),
    yAxis: ['spm()'],
    referrer: Referrer.LANDING_CACHE_THROUGHPUT_CHART,
  });

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
                label: MODULE_TITLE,
              },
            ]}
          />

          <Layout.Title>
            {MODULE_TITLE}
            <FeatureBadge type={RELEASE_LEVEL} />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <FloatingFeedbackWidget />

          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <PageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
            </ModuleLayout.Full>
            <ModuleLayout.Half>
              <CacheHitMissChart
                series={convertHitRateToMissRate(cacheHitRateData['cache_hit_rate()'])}
                isLoading={isCacheHitRateLoading}
                error={cacheHitRateError}
              />
            </ModuleLayout.Half>
            <ModuleLayout.Half>
              <ThroughputChart
                series={throughputData['spm()']}
                isLoading={isThroughputDataLoading}
                error={throughputError}
              />
            </ModuleLayout.Half>
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </React.Fragment>
  );
}

function LandingPageWithProviders() {
  return (
    <ModulePageProviders
      title={[t('Performance'), MODULE_TITLE].join(' — ')}
      baseURL="/performance/cache"
      features="performance-cache-view"
    >
      <CacheLandingPage />
    </ModulePageProviders>
  );
}

export default LandingPageWithProviders;
