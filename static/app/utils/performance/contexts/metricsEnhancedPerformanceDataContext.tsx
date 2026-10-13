import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useState} from 'react';

import {WIDGET_MAP_DENY_LIST} from 'sentry/views/performance/landing/widgets/utils';
import type {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';

import {AutoSampleState, useMEPSettingContext} from './metricsEnhancedSetting';

interface MetricsEnhancedPerformanceDataContext {
  setIsMetricsData: (value?: boolean) => void;
  isMetricsData?: boolean;
}

const MEPDataContext = createContext<MetricsEnhancedPerformanceDataContext | undefined>(
  undefined
);

export function useMEPDataContext(): MetricsEnhancedPerformanceDataContext {
  const context = useContext(MEPDataContext);
  if (context === undefined) {
    throw new Error(
      'useContext for "MetricsEnhancedPerformanceDataContext" must be inside a Provider with a value'
    );
  }
  return context;
}

export function MEPDataProvider({
  children,
  chartSetting,
}: {
  children: ReactNode;
  chartSetting?: PerformanceWidgetSetting;
}) {
  const {setAutoSampleState} = useMEPSettingContext();
  const [isMetricsData, _setIsMetricsData] = useState<boolean | undefined>(undefined); // Uses undefined to cover 'not initialized'

  const setIsMetricsData = useCallback(
    (value?: boolean) => {
      if (WIDGET_MAP_DENY_LIST.includes(chartSetting!)) {
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

  return (
    <MEPDataContext
      value={{
        isMetricsData,
        setIsMetricsData,
      }}
    >
      {children}
    </MEPDataContext>
  );
}

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
