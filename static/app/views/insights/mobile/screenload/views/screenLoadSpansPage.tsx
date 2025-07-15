import {Fragment} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {
  PRIMARY_RELEASE_ALIAS,
  ReleaseComparisonSelector,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/insights/common/components/releaseSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {useSamplesDrawer} from 'sentry/views/insights/common/utils/useSamplesDrawer';
import type {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {SpanSamplesPanel} from 'sentry/views/insights/mobile/common/components/spanSamplesPanel';
import {ScreenCharts} from 'sentry/views/insights/mobile/screenload/components/charts/screenCharts';
import {ScreenLoadEventSamples} from 'sentry/views/insights/mobile/screenload/components/eventSamples';
import {MobileMetricsRibbon} from 'sentry/views/insights/mobile/screenload/components/metricsRibbon';
import {ScreenLoadSpansTable} from 'sentry/views/insights/mobile/screenload/components/tables/screenLoadSpansTable';
import {
  MobileCursors,
  MobileSortKeys,
} from 'sentry/views/insights/mobile/screenload/constants';
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

export function ScreenLoadSpansContent() {
  const router = useRouter();
  const location = useLocation<Query>();

  const {spanGroup, transaction: transactionName} = location.query;
  const {primaryRelease, secondaryRelease} = useReleaseSelection();

  useSamplesDrawer({
    Component: (
      <SpanSamplesPanel groupId={spanGroup} moduleName={ModuleName.SCREEN_LOAD} />
    ),
    moduleName: ModuleName.SCREEN_LOAD,
    requiredParams: ['transaction', 'spanGroup'],
    onClose: () => {
      router.replace({
        pathname: router.location.pathname,
        query: omit(router.location.query, 'spanGroup', 'transactionMethod'),
      });
    },
  });

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
          filters={[
            'is_transaction:true',
            'transaction.op:[ui.load,navigation]',
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
          additionalFilters={[`transaction:${transactionName}`]}
          chartHeight={120}
        />
        <SampleContainer>
          <SampleContainerItem>
            {primaryRelease && (
              <ScreenLoadEventSamples
                release={primaryRelease}
                sortKey={MobileSortKeys.RELEASE_1_EVENT_SAMPLE_TABLE}
                cursorName={MobileCursors.RELEASE_1_EVENT_SAMPLE_TABLE}
                transaction={transactionName}
                showDeviceClassSelector
              />
            )}
          </SampleContainerItem>
          <SampleContainerItem>
            {secondaryRelease && (
              <ScreenLoadEventSamples
                release={secondaryRelease}
                sortKey={MobileSortKeys.RELEASE_2_EVENT_SAMPLE_TABLE}
                cursorName={MobileCursors.RELEASE_2_EVENT_SAMPLE_TABLE}
                transaction={transactionName}
              />
            )}
          </SampleContainerItem>
        </SampleContainer>
        <ScreenLoadSpansTable
          transaction={transactionName}
          primaryRelease={primaryRelease}
          secondaryRelease={secondaryRelease}
        />
      </ErrorBoundary>
    </Fragment>
  );
}

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
