import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useState} from 'react';

import type {Widget} from 'sentry/views/dashboards/types';
import {WIDGET_MAP_DENY_LIST} from 'sentry/views/performance/landing/widgets/utils';
import type {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';

import {AutoSampleState, useMEPSettingContext} from './metricsEnhancedSetting';

export type MetricsResultsMetaMapKey = Widget;
type ExtractedDataMap = Map<string, boolean | undefined>;

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

// A provider for handling all metas on the page, should be used if your queries and components aren't
// co-located since a local provider doesn't work in that case.
interface PerformanceDataMultipleMetaContext {
  metricsExtractedDataMap: ExtractedDataMap;
  setIsMetricsExtractedData: (mapKey: MetricsResultsMetaMapKey, value?: boolean) => void;
}

const MetricsResultsMetaContext = createContext<
  PerformanceDataMultipleMetaContext | undefined
>(undefined);

export function useMetricsResultsMeta(): PerformanceDataMultipleMetaContext | undefined {
  return useContext(MetricsResultsMetaContext);
}

export function MetricsResultsMetaProvider({children}: {children: ReactNode}) {
  const [metricsExtractedDataMap, _setMetricsExtractedDataMap] = useState(new Map());

  const setIsMetricsExtractedData = useCallback(
    (mapKey: MetricsResultsMetaMapKey, value?: boolean) => {
      if (mapKey.id) {
        metricsExtractedDataMap.set(mapKey.id, value);
      }
    },
    [metricsExtractedDataMap]
  );

  return (
    <MetricsResultsMetaContext
      value={{setIsMetricsExtractedData, metricsExtractedDataMap}}
    >
      {children}
    </MetricsResultsMetaContext>
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

type ExtractionStatus = 'extracted' | 'not-extracted' | null;

export function useExtractionStatus(_props: {
  queryKey: MetricsResultsMetaMapKey;
}): ExtractionStatus {
  return null;
}
