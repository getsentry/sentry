import {Fragment} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {
  PRIMARY_RELEASE_ALIAS,
  ReleaseComparisonSelector,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/insights/common/components/releaseSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {SpanSamplesPanel} from 'sentry/views/insights/mobile/common/components/spanSamplesPanel';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {
  ScreenCharts,
  YAxis,
} from 'sentry/views/insights/mobile/screenload/components/charts/screenCharts';
import {ScreenLoadEventSamples} from 'sentry/views/insights/mobile/screenload/components/eventSamples';
import {MobileMetricsRibbon} from 'sentry/views/insights/mobile/screenload/components/metricsRibbon';
import {PlatformSelector} from 'sentry/views/insights/mobile/screenload/components/platformSelector';
import {ScreenLoadSpansTable} from 'sentry/views/insights/mobile/screenload/components/tables/screenLoadSpansTable';
import {
  MobileCursors,
  MobileSortKeys,
} from 'sentry/views/insights/mobile/screenload/constants';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {ModuleName} from 'sentry/views/insights/types';

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
  const {isProjectCrossPlatform} = useCrossPlatformProject();
  const {transaction: transactionName} = location.query;

  return (
    <Layout.Page>
      <PageAlertProvider>
        <MobileHeader
          module={ModuleName.SCREEN_LOAD}
          headerTitle={transactionName}
          headerActions={isProjectCrossPlatform && <PlatformSelector />}
          breadcrumbs={[
            {
              label: t('Screen Summary'),
            },
          ]}
        />
        <Layout.Body>
          <Layout.Main fullWidth>
            <PageAlert />
            <ScreenLoadSpansContent />
          </Layout.Main>
        </Layout.Body>
      </PageAlertProvider>
    </Layout.Page>
  );
}

export function ScreenLoadSpansContent() {
  const location = useLocation<Query>();
  const router = useRouter();

  const {
    spanGroup,
    primaryRelease,
    secondaryRelease,
    transaction: transactionName,
    spanDescription,
  } = location.query;

  return (
    <Fragment>
      <HeaderContainer>
        <ToolRibbon>
          <FilterContainer>
            <ModulePageFilterBar moduleName={ModuleName.APP_START} disableProjectFilter />
            <ReleaseComparisonSelector />
          </FilterContainer>
        </ToolRibbon>

        <MobileMetricsRibbon
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
            `count_if(measurements.time_to_initial_display,release,${primaryRelease})`,
            `count_if(measurements.time_to_initial_display,release,${secondaryRelease})`,
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
              dataKey: `count_if(measurements.time_to_initial_display,release,${primaryRelease})`,
              title: t('Total Count (%s)', PRIMARY_RELEASE_ALIAS),
            },
            {
              unit: 'count',
              dataKey: `count_if(measurements.time_to_initial_display,release,${secondaryRelease})`,
              title: t('Total Count (%s)', SECONDARY_RELEASE_ALIAS),
            },
          ]}
          referrer="api.starfish.mobile-screen-totals"
        />
      </HeaderContainer>

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
                query: omit(router.location.query, 'spanGroup', 'transactionMethod'),
              });
            }}
          />
        )}
      </ErrorBoundary>
    </Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      moduleName="screen_load"
      pageTitle={t('Screen Summary')}
      features="insights-initial-modules"
    >
      <ScreenLoadSpans />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

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
