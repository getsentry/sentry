import React, {useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ReleaseSelector} from 'sentry/views/insights/common/components/releaseSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {useSamplesDrawer} from 'sentry/views/insights/common/utils/useSamplesDrawer';
import type {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {DeviceClassSelector} from 'sentry/views/insights/mobile/common/components/deviceClassSelector';
import {SpanSamplesPanel} from 'sentry/views/insights/mobile/common/components/spanSamplesPanel';
import {AffectSelector} from 'sentry/views/insights/mobile/screenload/components/affectSelector';
import {ScreenCharts} from 'sentry/views/insights/mobile/screenload/components/charts/screenCharts';
import {ScreenLoadEventSamples} from 'sentry/views/insights/mobile/screenload/components/eventSamples';
import {MobileMetricsRibbon} from 'sentry/views/insights/mobile/screenload/components/metricsRibbon';
import {SpanOpSelector} from 'sentry/views/insights/mobile/screenload/components/spanOpSelector';
import {ScreenLoadSpansTable} from 'sentry/views/insights/mobile/screenload/components/tables/screenLoadSpansTable';
import {
  MobileCursors,
  MobileSortKeys,
} from 'sentry/views/insights/mobile/screenload/constants';
import {ModuleName} from 'sentry/views/insights/types';

type Query = {
  primaryRelease: string;
  project: string;
  spanGroup: string;
  transaction: string;
  [QueryParameterNames.SPANS_SORT]: string;
  spanDescription?: string;
};

const EVENT = 'event';
const SPANS = 'spans';

export function ScreenLoadSpansContent() {
  const router = useRouter();
  const location = useLocation<Query>();
  const [sampleType, setSampleType] = useState<typeof EVENT | typeof SPANS>(SPANS);

  const {spanGroup, transaction: transactionName} = location.query;
  const {primaryRelease} = useReleaseSelection();

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
    <React.Fragment>
      <HeaderContainer>
        <ToolRibbon>
          <FilterContainer>
            <ModulePageFilterBar
              moduleName={ModuleName.SCREEN_LOAD}
              disableProjectFilter
            />
            <ReleaseSelector moduleName={ModuleName.SCREEN_LOAD} />
          </FilterContainer>
        </ToolRibbon>

        <MobileMetricsRibbon
          filters={[
            'is_transaction:true',
            'transaction.op:[ui.load,navigation]',
            `transaction:${transactionName}`,
          ]}
          fields={[
            primaryRelease
              ? `avg_if(measurements.time_to_initial_display,release,equals,${primaryRelease})`
              : 'avg(measurements.time_to_initial_display)',
            primaryRelease
              ? `avg_if(measurements.time_to_full_display,release,equals,${primaryRelease})`
              : 'avg(measurements.time_to_full_display)',
            primaryRelease
              ? `count_if(measurements.time_to_initial_display,release,equals,${primaryRelease})`
              : 'count()',
          ]}
          blocks={[
            {
              unit: DurationUnit.MILLISECOND,
              dataKey: primaryRelease
                ? `avg_if(measurements.time_to_initial_display,release,equals,${primaryRelease})`
                : 'avg(measurements.time_to_initial_display)',
              title: t('Avg TTID'),
            },
            {
              unit: DurationUnit.MILLISECOND,
              dataKey: primaryRelease
                ? `avg_if(measurements.time_to_full_display,release,equals,${primaryRelease})`
                : 'avg(measurements.time_to_full_display)',
              title: t('Avg TTFD'),
            },
            {
              unit: 'count',
              dataKey: primaryRelease
                ? `count_if(measurements.time_to_initial_display,release,equals,${primaryRelease})`
                : 'count()',
              title: t('Total Count'),
            },
          ]}
          referrer="api.insights.mobile-screen-totals"
        />
      </HeaderContainer>

      <ErrorBoundary mini>
        <ScreenCharts
          additionalFilters={[`transaction:${transactionName}`]}
          chartHeight={120}
        />
        <Controls>
          <FiltersContainer>
            {sampleType === SPANS && (
              <SpanOpSelector
                primaryRelease={primaryRelease}
                transaction={transactionName}
              />
            )}
            {sampleType === EVENT && (
              <DeviceClassSelector
                size="md"
                clearSpansTableCursor
                moduleName={ModuleName.APP_START}
              />
            )}
            {sampleType === EVENT && <SubregionSelector />}
            {sampleType === SPANS && <AffectSelector transaction={transactionName} />}
          </FiltersContainer>
          <SegmentedControl
            onChange={value => {
              setSampleType(value);
            }}
            value={sampleType}
            aria-label={t('Sample Type Selection')}
          >
            <SegmentedControl.Item key={SPANS}>{t('By Spans')}</SegmentedControl.Item>
            <SegmentedControl.Item key={EVENT}>{t('By Event')}</SegmentedControl.Item>
          </SegmentedControl>
        </Controls>
        {sampleType === EVENT && (
          <SampleContainer>
            <SampleContainerItem>
              <ScreenLoadEventSamples
                release={primaryRelease}
                sortKey={MobileSortKeys.RELEASE_1_EVENT_SAMPLE_TABLE}
                cursorName={MobileCursors.RELEASE_1_EVENT_SAMPLE_TABLE}
                transaction={transactionName}
              />
            </SampleContainerItem>
          </SampleContainer>
        )}
        {sampleType === SPANS && (
          <ScreenLoadSpansTable
            transaction={transactionName}
            primaryRelease={primaryRelease}
          />
        )}
      </ErrorBoundary>
    </React.Fragment>
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

const Controls = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(1)};
`;

const FiltersContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  margin-top: ${space(1)};
`;
