import {ReactNode, useCallback, useState} from 'react';

import Tag from 'sentry/components/tag';
import useOrganization from 'sentry/utils/useOrganization';
import {WIDGET_MAP_DENY_LIST} from 'sentry/views/performance/landing/widgets/utils';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';

import {AutoSampleState, useMEPSettingContext} from './metricsEnhancedSetting';
import {createDefinedContext} from './utils';

export interface MetricsEnhancedPerformanceDataContext {
  setIsMetricsData: (value?: boolean) => void;
  setIsOnDemandData: (value?: boolean) => void;
  isMetricsData?: boolean;
  isOnDemandData?: boolean;
}

const [_MEPDataProvider, _useMEPDataContext] =
  createDefinedContext<MetricsEnhancedPerformanceDataContext>({
    name: 'MetricsEnhancedPerformanceDataContext',
  });

export function MEPDataProvider({
  children,
  chartSetting,
}: {
  children: ReactNode;
  chartSetting?: PerformanceWidgetSetting;
}) {
  const {setAutoSampleState} = useMEPSettingContext();
  const [isMetricsData, _setIsMetricsData] = useState<boolean | undefined>(undefined); // Uses undefined to cover 'not initialized'
  const [isOnDemandData, _setIsOnDemandData] = useState<boolean | undefined>(undefined); // Uses undefined to cover 'not initialized'

  const setIsMetricsData = useCallback(
    (value?: boolean) => {
      if (WIDGET_MAP_DENY_LIST.includes(chartSetting as PerformanceWidgetSetting)) {
        // Certain widgets shouldn't update their sampled tags or have the page info change eg. Auto(...)
        return;
      }
      if (value === true) {
        setAutoSampleState(AutoSampleState.METRICS);
      } else if (value === false) {
        setAutoSampleState(AutoSampleState.TRANSACTIONS);
      }
      _setIsMetricsData(value);
    },
    [setAutoSampleState, _setIsMetricsData, chartSetting]
  );

  const setIsOnDemandData = useCallback(
    (value?: boolean) => {
      _setIsOnDemandData(value);
    },
    [_setIsOnDemandData]
  );

  return (
    <_MEPDataProvider
      value={{isMetricsData, setIsMetricsData, isOnDemandData, setIsOnDemandData}}
    >
      {children}
    </_MEPDataProvider>
  );
}

export const useMEPDataContext = _useMEPDataContext;

export function getIsMetricsDataFromResults(
  results: any,
  field = ''
): boolean | undefined {
  const isMetricsData =
    results?.meta?.isMetricsData ??
    results?.seriesAdditionalInfo?.[field]?.isMetricsData ??
    results?.histograms?.meta?.isMetricsData ??
    results?.tableData?.meta?.isMetricsData;
  return isMetricsData;
}

export function getIsOnDemandDataFromResults(
  results: any,
  field = ''
): boolean | undefined {
  const isOnDemandData =
    results?.meta?.isOnDemandData ??
    results?.seriesAdditionalInfo?.[field]?.isOnDemandData ??
    results?.histograms?.meta?.isOnDemandData ??
    results?.tableData?.meta?.isOnDemandData;
  return isOnDemandData;
}

export function MEPTag() {
  const {isMetricsData} = useMEPDataContext();
  const organization = useOrganization();

  if (!organization.features.includes('performance-use-metrics')) {
    // Separate if for easier flag deletion
    return null;
  }

  if (isMetricsData === undefined) {
    return <span data-test-id="no-metrics-data-tag" />;
  }

  const tagText = isMetricsData ? 'processed' : 'indexed';

  return <Tag data-test-id="has-metrics-data-tag">{tagText}</Tag>;
}
