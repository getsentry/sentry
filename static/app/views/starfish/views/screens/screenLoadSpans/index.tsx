import {useMemo} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';
import omit from 'lodash/omit';

import type {Crumb} from 'sentry/components/breadcrumbs';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  PRIMARY_RELEASE_ALIAS,
  ReleaseComparisonSelector,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/starfish/components/releaseSelector';
import {StarfishPageFiltersContainer} from 'sentry/views/starfish/components/starfishPageFiltersContainer';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {
  MobileCursors,
  MobileSortKeys,
} from 'sentry/views/starfish/views/screens/constants';
import {PlatformSelector} from 'sentry/views/starfish/views/screens/platformSelector';
import {
  ScreenCharts,
  YAxis,
} from 'sentry/views/starfish/views/screens/screenLoadSpans/charts';
import {ScreenLoadEventSamples} from 'sentry/views/starfish/views/screens/screenLoadSpans/eventSamples';
import {MetricsRibbon} from 'sentry/views/starfish/views/screens/screenLoadSpans/metricsRibbon';
import {ScreenLoadSpanSamples} from 'sentry/views/starfish/views/screens/screenLoadSpans/samples';
import {ScreenLoadSpansTable} from 'sentry/views/starfish/views/screens/screenLoadSpans/table';
import {isCrossPlatform} from 'sentry/views/starfish/views/screens/utils';

type Query = {
  primaryRelease: string;
  project: string;
  secondaryRelease: string;
  spanGroup: string;
  transaction: string;
  [QueryParameterNames.SPANS_SORT]: string;
  spanDescription?: string;
};

function ScreenLoadSpans() {
  const location = useLocation<Query>();
  const organization = useOrganization();
  const router = useRouter();

  const {projects} = useProjects();
  const project = useMemo(() => {
    return projects.find(p => p.id === location.query.project);
  }, [location.query.project, projects]);

  const screenLoadModule: LocationDescriptor = {
    pathname: `/organizations/${organization.slug}/performance/mobile/screens/`,
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
      label: t('Performance'),
      to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
      preservePageFilters: true,
    },
    {
      to: screenLoadModule,
      label: t('Screen Loads'),
      preservePageFilters: true,
    },
    {
      to: '',
      label: t('Screen Summary'),
    },
  ];

  const {
    spanGroup,
    primaryRelease,
    secondaryRelease,
    transaction: transactionName,
    spanDescription,
  } = location.query;

  return (
    <SentryDocumentTitle title={transactionName} orgSlug={organization.slug}>
      <Layout.Page>
        <PageAlertProvider>
          <Layout.Header>
            <Layout.HeaderContent>
              <Breadcrumbs crumbs={crumbs} />
              <HeaderWrapper>
                <Layout.Title>{transactionName}</Layout.Title>
                {organization.features.includes(
                  'performance-screens-platform-selector'
                ) &&
                  project &&
                  isCrossPlatform(project) && <PlatformSelector />}
              </HeaderWrapper>
            </Layout.HeaderContent>
          </Layout.Header>
          <Layout.Body>
            <FloatingFeedbackWidget />
            <Layout.Main fullWidth>
              <PageAlert />
              <StarfishPageFiltersContainer>
                <Container>
                  <FilterContainer>
                    <PageFilterBar condensed>
                      <DatePageFilter />
                    </PageFilterBar>
                    <ReleaseComparisonSelector />
                  </FilterContainer>
                  <MetricsRibbon
                    dataset={DiscoverDatasets.METRICS}
                    filters={[
                      'event.type:transaction',
                      'transaction.op:ui.load',
                      `transaction:${transactionName}`,
                    ]}
                    fields={[
                      `avg_if(measurements.time_to_initial_display,release,${primaryRelease})`,
                      `avg_if(measurements.time_to_initial_display,release,${secondaryRelease})`,
                      `avg_if(measurements.time_to_full_display,release,${primaryRelease})`,
                      `avg_if(measurements.time_to_full_display,release,${secondaryRelease})`,
                      'count()',
                    ]}
                    blocks={[
                      {
                        type: 'duration',
                        dataKey: `avg_if(measurements.time_to_initial_display,release,${primaryRelease})`,
                        title: t('TTID (%s)', PRIMARY_RELEASE_ALIAS),
                      },
                      {
                        type: 'duration',
                        dataKey: `avg_if(measurements.time_to_initial_display,release,${secondaryRelease})`,
                        title: t('TTID (%s)', SECONDARY_RELEASE_ALIAS),
                      },
                      {
                        type: 'duration',
                        dataKey: `avg_if(measurements.time_to_full_display,release,${primaryRelease})`,
                        title: t('TTFD (%s)', PRIMARY_RELEASE_ALIAS),
                      },
                      {
                        type: 'duration',
                        dataKey: `avg_if(measurements.time_to_full_display,release,${secondaryRelease})`,
                        title: t('TTFD (%s)', SECONDARY_RELEASE_ALIAS),
                      },
                      {
                        type: 'count',
                        dataKey: 'count()',
                        title: t('Count'),
                      },
                    ]}
                    referrer="api.starfish.mobile-screen-totals"
                  />
                </Container>
              </StarfishPageFiltersContainer>
              <ErrorBoundary mini>
                <ScreenCharts
                  yAxes={[YAxis.TTID, YAxis.TTFD, YAxis.COUNT]}
                  additionalFilters={[`transaction:${transactionName}`]}
                  chartHeight={120}
                  project={project}
                />
                <SampleContainer>
                  <SampleContainerItem>
                    <ScreenLoadEventSamples
                      release={primaryRelease}
                      sortKey={MobileSortKeys.RELEASE_1_EVENT_SAMPLE_TABLE}
                      cursorName={MobileCursors.RELEASE_1_EVENT_SAMPLE_TABLE}
                      transaction={transactionName}
                      showDeviceClassSelector
                      project={project}
                    />
                  </SampleContainerItem>
                  <SampleContainerItem>
                    <ScreenLoadEventSamples
                      release={secondaryRelease}
                      sortKey={MobileSortKeys.RELEASE_2_EVENT_SAMPLE_TABLE}
                      cursorName={MobileCursors.RELEASE_2_EVENT_SAMPLE_TABLE}
                      transaction={transactionName}
                      project={project}
                    />
                  </SampleContainerItem>
                </SampleContainer>
                <ScreenLoadSpansTable
                  transaction={transactionName}
                  primaryRelease={primaryRelease}
                  secondaryRelease={secondaryRelease}
                  project={project}
                />
                {spanGroup && (
                  <ScreenLoadSpanSamples
                    groupId={spanGroup}
                    transactionName={transactionName}
                    spanDescription={spanDescription}
                    onClose={() => {
                      router.replace({
                        pathname: router.location.pathname,
                        query: omit(
                          router.location.query,
                          'spanGroup',
                          'transactionMethod'
                        ),
                      });
                    }}
                  />
                )}
              </ErrorBoundary>
            </Layout.Main>
          </Layout.Body>
        </PageAlertProvider>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

export default ScreenLoadSpans;

const Container = styled('div')`
  display: grid;
  grid-template-rows: 1fr 1fr;
  grid-template-columns: 1fr;
  column-gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-rows: auto;
    grid-template-columns: auto minmax(100px, max-content);
  }
`;

const FilterContainer = styled('div')`
  display: grid;
  column-gap: ${space(1)};
  grid-template-rows: auto;
  grid-template-columns: auto 1fr;
`;

const SampleContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const SampleContainerItem = styled('div')`
  flex: 1;
`;
const HeaderWrapper = styled('div')`
  display: flex;
`;
