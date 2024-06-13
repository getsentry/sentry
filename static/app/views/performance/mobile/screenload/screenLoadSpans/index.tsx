import styled from '@emotion/styled';
import omit from 'lodash/omit';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {SpanSamplesPanel} from 'sentry/views/performance/mobile/components/spanSamplesPanel';
import {
  ScreenCharts,
  YAxis,
} from 'sentry/views/performance/mobile/screenload/screenLoadSpans/charts';
import {ScreenLoadEventSamples} from 'sentry/views/performance/mobile/screenload/screenLoadSpans/eventSamples';
import {MetricsRibbon} from 'sentry/views/performance/mobile/screenload/screenLoadSpans/metricsRibbon';
import {ScreenLoadSpansTable} from 'sentry/views/performance/mobile/screenload/screenLoadSpans/table';
import {
  MobileCursors,
  MobileSortKeys,
} from 'sentry/views/performance/mobile/screenload/screens/constants';
import {PlatformSelector} from 'sentry/views/performance/mobile/screenload/screens/platformSelector';
import useCrossPlatformProject from 'sentry/views/performance/mobile/useCrossPlatformProject';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {useModuleBreadcrumbs} from 'sentry/views/performance/utils/useModuleBreadcrumbs';
import {
  PRIMARY_RELEASE_ALIAS,
  ReleaseComparisonSelector,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/starfish/components/releaseSelector';
import {ModuleName} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

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
  const {isProjectCrossPlatform} = useCrossPlatformProject();

  const crumbs = useModuleBreadcrumbs('screen_load');

  const {
    spanGroup,
    primaryRelease,
    secondaryRelease,
    transaction: transactionName,
    spanDescription,
  } = location.query;

  return (
    <Layout.Page>
      <PageAlertProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                ...crumbs,
                {
                  label: t('Screen Summary'),
                },
              ]}
            />
            <HeaderWrapper>
              <Layout.Title>{transactionName}</Layout.Title>
              {organization.features.includes('insights-initial-modules') &&
                isProjectCrossPlatform && <PlatformSelector />}
            </HeaderWrapper>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <FeedbackWidgetButton />
            </ButtonBar>
          </Layout.HeaderActions>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <PageAlert />
            <Container>
              <FilterContainer>
                <PageFilterBar condensed>
                  <EnvironmentPageFilter />
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
                    unit: DurationUnit.MILLISECOND,
                    dataKey: `avg_if(measurements.time_to_initial_display,release,${primaryRelease})`,
                    title: t('Avg TTID (%s)', PRIMARY_RELEASE_ALIAS),
                  },
                  {
                    unit: DurationUnit.MILLISECOND,
                    dataKey: `avg_if(measurements.time_to_initial_display,release,${secondaryRelease})`,
                    title: t('Avg TTID (%s)', SECONDARY_RELEASE_ALIAS),
                  },
                  {
                    unit: DurationUnit.MILLISECOND,
                    dataKey: `avg_if(measurements.time_to_full_display,release,${primaryRelease})`,
                    title: t('Avg TTFD (%s)', PRIMARY_RELEASE_ALIAS),
                  },
                  {
                    unit: DurationUnit.MILLISECOND,
                    dataKey: `avg_if(measurements.time_to_full_display,release,${secondaryRelease})`,
                    title: t('Avg TTFD (%s)', SECONDARY_RELEASE_ALIAS),
                  },
                  {
                    unit: 'count',
                    dataKey: 'count()',
                    title: t('Total Count'),
                  },
                ]}
                referrer="api.starfish.mobile-screen-totals"
              />
            </Container>
            <ErrorBoundary mini>
              <ScreenCharts
                yAxes={[YAxis.TTID, YAxis.TTFD, YAxis.COUNT]}
                additionalFilters={[`transaction:${transactionName}`]}
                chartHeight={120}
              />
              <SampleContainer>
                <SampleContainerItem>
                  <ScreenLoadEventSamples
                    release={primaryRelease}
                    sortKey={MobileSortKeys.RELEASE_1_EVENT_SAMPLE_TABLE}
                    cursorName={MobileCursors.RELEASE_1_EVENT_SAMPLE_TABLE}
                    transaction={transactionName}
                    showDeviceClassSelector
                  />
                </SampleContainerItem>
                <SampleContainerItem>
                  <ScreenLoadEventSamples
                    release={secondaryRelease}
                    sortKey={MobileSortKeys.RELEASE_2_EVENT_SAMPLE_TABLE}
                    cursorName={MobileCursors.RELEASE_2_EVENT_SAMPLE_TABLE}
                    transaction={transactionName}
                  />
                </SampleContainerItem>
              </SampleContainer>
              <ScreenLoadSpansTable
                transaction={transactionName}
                primaryRelease={primaryRelease}
                secondaryRelease={secondaryRelease}
              />
              {spanGroup && (
                <SpanSamplesPanel
                  groupId={spanGroup}
                  moduleName={ModuleName.SCREEN_LOAD}
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
  );
}

function PageWithProviders() {
  const location = useLocation<Query>();

  const {transaction} = location.query;

  return (
    <ModulePageProviders
      moduleName="screen_load"
      pageTitle={transaction}
      features="insights-initial-modules"
    >
      <ScreenLoadSpans />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

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
