import {useEffect} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';
import omit from 'lodash/omit';

import type {Crumb} from 'sentry/components/breadcrumbs';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  PRIMARY_RELEASE_ALIAS,
  ReleaseComparisonSelector,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/starfish/components/releaseSelector';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {SamplesTables} from 'sentry/views/starfish/views/appStartup/screenSummary/samples';
import {
  COLD_START_TYPE,
  StartTypeSelector,
} from 'sentry/views/starfish/views/appStartup/screenSummary/startTypeSelector';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {MetricsRibbon} from 'sentry/views/starfish/views/screens/screenLoadSpans/metricsRibbon';
import {ScreenLoadSpanSamples} from 'sentry/views/starfish/views/screens/screenLoadSpans/samples';

import AppStartWidgets from './widgets';

type Query = {
  [SpanMetricsField.APP_START_TYPE]: string;
  'device.class': string;
  primaryRelease: string;
  project: string;
  secondaryRelease: string;
  spanDescription: string;
  spanGroup: string;
  spanOp: string;
  transaction: string;
};

function ScreenSummary() {
  const organization = useOrganization();
  const location = useLocation<Query>();
  const router = useRouter();

  const {
    primaryRelease,
    secondaryRelease,
    transaction: transactionName,
    spanGroup,
    spanDescription,
    spanOp,
    [SpanMetricsField.APP_START_TYPE]: appStartType,
    'device.class': deviceClass,
  } = location.query;

  useEffect(() => {
    // Default the start type to cold start if not present
    if (!appStartType) {
      browserHistory.replace({
        ...location,
        query: {
          ...location.query,
          [SpanMetricsField.APP_START_TYPE]: COLD_START_TYPE,
        },
      });
    }
  }, [location, appStartType]);

  const startupModule: LocationDescriptor = {
    pathname: `/organizations/${organization.slug}/performance/mobile/app-startup/`,
    query: {
      ...omit(location.query, [
        QueryParameterNames.SPANS_SORT,
        'transaction',
        SpanMetricsField.SPAN_OP,
        SpanMetricsField.APP_START_TYPE,
      ]),
    },
  };

  const crumbs: Crumb[] = [
    {
      label: t('Performance'),
      to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
      preservePageFilters: true,
    },
    {
      to: startupModule,
      label: t('App Starts'),
      preservePageFilters: true,
    },
    {
      to: '',
      label: t('Screen Summary'),
    },
  ];

  return (
    <SentryDocumentTitle title={transactionName} orgSlug={organization.slug}>
      <Layout.Page>
        <PageAlertProvider>
          <Layout.Header>
            <Layout.HeaderContent>
              <Breadcrumbs crumbs={crumbs} />
              <Layout.Title>{transactionName}</Layout.Title>
            </Layout.HeaderContent>
          </Layout.Header>

          <Layout.Body>
            <Layout.Main fullWidth>
              <PageAlert />
              <HeaderContainer>
                <ControlsContainer>
                  <PageFiltersContainer>
                    <PageFilterBar condensed>
                      <DatePageFilter />
                    </PageFilterBar>
                  </PageFiltersContainer>
                  <ReleaseComparisonSelector />
                  <StartTypeSelector />
                </ControlsContainer>
                <MetricsRibbon
                  dataset={DiscoverDatasets.SPANS_METRICS}
                  filters={[
                    `transaction:${transactionName}`,
                    `span.op:app.start.${appStartType}`,
                    '(',
                    'span.description:"Cold Start"',
                    'OR',
                    'span.description:"Warm Start"',
                    ')',
                  ]}
                  fields={[
                    `avg_if(span.duration,release,${primaryRelease})`,
                    `avg_if(span.duration,release,${secondaryRelease})`,
                    `avg_compare(span.duration,release,${primaryRelease},${secondaryRelease})`,
                    'count()',
                  ]}
                  blocks={[
                    {
                      type: 'duration',
                      allowZero: false,
                      title:
                        appStartType === COLD_START_TYPE
                          ? t('Cold Start (%s)', PRIMARY_RELEASE_ALIAS)
                          : t('Warm Start (%s)', PRIMARY_RELEASE_ALIAS),
                      dataKey: `avg_if(span.duration,release,${primaryRelease})`,
                    },
                    {
                      type: 'duration',
                      allowZero: false,
                      title:
                        appStartType === COLD_START_TYPE
                          ? t('Cold Start (%s)', SECONDARY_RELEASE_ALIAS)
                          : t('Warm Start (%s)', SECONDARY_RELEASE_ALIAS),
                      dataKey: `avg_if(span.duration,release,${secondaryRelease})`,
                    },
                    {
                      type: 'change',
                      title: t('Change'),
                      dataKey: `avg_compare(span.duration,release,${primaryRelease},${secondaryRelease})`,
                    },
                    {
                      type: 'count',
                      title: t('Count'),
                      dataKey: 'count()',
                    },
                  ]}
                  referrer="api.starfish.mobile-startup-totals"
                />
              </HeaderContainer>
              <ErrorBoundary mini>
                <AppStartWidgets additionalFilters={[`transaction:${transactionName}`]} />
              </ErrorBoundary>
              <SamplesContainer>
                <SamplesTables transactionName={transactionName} />
              </SamplesContainer>
              {spanGroup && spanOp && appStartType && (
                <ScreenLoadSpanSamples
                  additionalFilters={{
                    [SpanMetricsField.APP_START_TYPE]: appStartType,
                    ...(deviceClass
                      ? {[SpanMetricsField.DEVICE_CLASS]: deviceClass}
                      : {}),
                  }}
                  groupId={spanGroup}
                  transactionName={transactionName}
                  spanDescription={spanDescription}
                  spanOp={spanOp}
                  onClose={() => {
                    router.replace({
                      pathname: router.location.pathname,
                      query: omit(
                        router.location.query,
                        'spanGroup',
                        'transactionMethod',
                        'spanDescription',
                        'spanOp'
                      ),
                    });
                  }}
                />
              )}
            </Layout.Main>
          </Layout.Body>
        </PageAlertProvider>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

export default ScreenSummary;

const ControlsContainer = styled('div')`
  display: flex;
  gap: ${space(1.5)};
`;

const HeaderContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(2)};
  justify-content: space-between;
`;

const SamplesContainer = styled('div')`
  margin-top: ${space(2)};
`;
