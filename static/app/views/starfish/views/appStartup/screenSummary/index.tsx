import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';
import omit from 'lodash/omit';

import Breadcrumbs, {Crumb} from 'sentry/components/breadcrumbs';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {ReleaseComparisonSelector} from 'sentry/views/starfish/components/releaseSelector';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {EventSamples} from 'sentry/views/starfish/views/appStartup/screenSummary/eventSamples';
import {SpanOperationTable} from 'sentry/views/starfish/views/appStartup/screenSummary/spanOperationTable';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {
  MobileCursors,
  MobileSortKeys,
} from 'sentry/views/starfish/views/screens/constants';
import {MetricsRibbon} from 'sentry/views/starfish/views/screens/screenLoadSpans/metricsRibbon';
import {ScreenLoadSpanSamples} from 'sentry/views/starfish/views/screens/screenLoadSpans/samples';

import AppStartWidgets from './widgets';

type Query = {
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
  } = location.query;

  const startupModule: LocationDescriptor = {
    pathname: `/organizations/${organization.slug}/performance/mobile/app-startup/`,
    query: {
      ...omit(location.query, [
        QueryParameterNames.SPANS_SORT,
        'transaction',
        SpanMetricsField.SPAN_OP,
      ]),
    },
  };

  const crumbs: Crumb[] = [
    {
      to: startupModule,
      label: t('App Startup'),
      preservePageFilters: true,
    },
    {
      to: '',
      label: t('Screen Summary'),
    },
  ];

  const truncatedPrimary = formatVersionAndCenterTruncate(primaryRelease ?? '', 10);
  const truncatedSecondary = formatVersionAndCenterTruncate(secondaryRelease ?? '', 10);

  return (
    <SentryDocumentTitle title={transactionName} orgSlug={organization.slug}>
      <Layout.Page>
        <PageErrorProvider>
          <Layout.Header>
            <Layout.HeaderContent>
              <Breadcrumbs crumbs={crumbs} />
              <Layout.Title>{transactionName}</Layout.Title>
            </Layout.HeaderContent>
          </Layout.Header>

          <Layout.Body>
            <Layout.Main fullWidth>
              <PageErrorAlert />
              <PageFiltersContainer>
                <Container>
                  <PageFilterBar condensed>
                    <DatePageFilter />
                  </PageFilterBar>
                  <ReleaseComparisonSelector />
                  <MetricsRibbon
                    dataset={DiscoverDatasets.SPANS_METRICS}
                    filters={[
                      `transaction:${transactionName}`,
                      `span.op:[app.start.cold,app.start.warm]`,
                      '(',
                      'span.description:"Cold Start"',
                      'OR',
                      'span.description:"Warm Start"',
                      ')',
                    ]}
                    fields={[
                      `avg_if(span.duration,release,${primaryRelease})`,
                      `avg_if(span.duration,release,${secondaryRelease})`,
                      'span.op',
                      'count()',
                    ]}
                    blocks={[
                      {
                        type: 'duration',
                        title: t('Cold Start (%s)', truncatedPrimary),
                        dataKey: data => {
                          const matchingRow = data?.find(
                            row => row['span.op'] === 'app.start.cold'
                          );
                          return (
                            (matchingRow?.[
                              `avg_if(span.duration,release,${primaryRelease})`
                            ] as number) ?? 0
                          );
                        },
                      },
                      {
                        type: 'duration',
                        title: t('Cold Start (%s)', truncatedSecondary),
                        dataKey: data => {
                          const matchingRow = data?.find(
                            row => row['span.op'] === 'app.start.cold'
                          );
                          return (
                            (matchingRow?.[
                              `avg_if(span.duration,release,${secondaryRelease})`
                            ] as number) ?? 0
                          );
                        },
                      },
                      {
                        type: 'duration',
                        title: t('Warm Start (%s)', truncatedPrimary),
                        dataKey: data => {
                          const matchingRow = data?.find(
                            row => row['span.op'] === 'app.start.warm'
                          );
                          return (
                            (matchingRow?.[
                              `avg_if(span.duration,release,${primaryRelease})`
                            ] as number) ?? 0
                          );
                        },
                      },
                      {
                        type: 'duration',
                        title: t('Warm Start (%s)', truncatedSecondary),
                        dataKey: data => {
                          const matchingRow = data?.find(
                            row => row['span.op'] === 'app.start.warm'
                          );
                          return (
                            (matchingRow?.[
                              `avg_if(span.duration,release,${secondaryRelease})`
                            ] as number) ?? 0
                          );
                        },
                      },
                      {
                        type: 'count',
                        title: t('Count'),
                        dataKey: data => {
                          return data?.reduce(
                            (acc, row) => acc + (row['count()'] as number),
                            0
                          );
                        },
                      },
                    ]}
                    referrer="api.starfish.mobile-startup-totals"
                  />
                </Container>
              </PageFiltersContainer>
              <ErrorBoundary mini>
                <AppStartWidgets additionalFilters={[`transaction:${transactionName}`]} />
              </ErrorBoundary>
              <EventSamplesContainer>
                <ErrorBoundary mini>
                  <div>
                    <EventSamples
                      cursorName={MobileCursors.RELEASE_1_EVENT_SAMPLE_TABLE}
                      sortKey={MobileSortKeys.RELEASE_1_EVENT_SAMPLE_TABLE}
                      release={primaryRelease}
                      transaction={transactionName}
                      showDeviceClassSelector
                    />
                  </div>
                </ErrorBoundary>
                <ErrorBoundary mini>
                  <div>
                    <EventSamples
                      cursorName={MobileCursors.RELEASE_2_EVENT_SAMPLE_TABLE}
                      sortKey={MobileSortKeys.RELEASE_2_EVENT_SAMPLE_TABLE}
                      release={secondaryRelease}
                      transaction={transactionName}
                    />
                  </div>
                </ErrorBoundary>
              </EventSamplesContainer>
              <ErrorBoundary mini>
                <SpanOperationTable
                  transaction={transactionName}
                  primaryRelease={primaryRelease}
                  secondaryRelease={secondaryRelease}
                />
              </ErrorBoundary>
              {spanGroup && spanOp && (
                <ScreenLoadSpanSamples
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
        </PageErrorProvider>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

export default ScreenSummary;

const Container = styled('div')`
  display: grid;
  grid-template-rows: auto auto auto;
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-rows: auto;
    grid-template-columns: auto 1fr auto;
  }
`;

const EventSamplesContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-top: ${space(2)};
  gap: ${space(2)};
`;
