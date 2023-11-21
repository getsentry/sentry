import {ReactNode, useCallback, useState} from 'react';

import Tag from 'sentry/components/tag';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {Widget} from 'sentry/views/dashboards/types';
import {WIDGET_MAP_DENY_LIST} from 'sentry/views/performance/landing/widgets/utils';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';

import {AutoSampleState, useMEPSettingContext} from './metricsEnhancedSetting';
import {useOnDemandControl} from './onDemandControl';
import {createDefinedContext} from './utils';

export type MetricsResultsMetaMapKey = Widget;
type ExtractedDataMap = Map<string, boolean | undefined>;

export interface MetricsEnhancedPerformanceDataContext {
  setIsMetricsData: (value?: boolean) => void;
  isMetricsData?: boolean;
}

const [_MEPDataProvider, _useMEPDataContext, _Context] =
  createDefinedContext<MetricsEnhancedPerformanceDataContext>({
    name: 'MetricsEnhancedPerformanceDataContext',
  });

export const MEPDataConsumer = _Context.Consumer;
export const MEPDataContext = _Context;
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

  return (
    <_MEPDataProvider
      value={{
        isMetricsData,
        setIsMetricsData,
      }}
    >
      {children}
    </_MEPDataProvider>
  );
}

export const useMEPDataContext = _useMEPDataContext;

// A provider for handling all metas on the page, should be used if your queries and components aren't
// co-located since a local provider doesn't work in that case.
export interface PerformanceDataMultipleMetaContext {
  metricsExtractedDataMap: ExtractedDataMap;
  setIsMetricsExtractedData: (mapKey: MetricsResultsMetaMapKey, value?: boolean) => void;
}

const [_MetricsResultsMetaProvider, _useMetricsResultsMeta] =
  createDefinedContext<PerformanceDataMultipleMetaContext>({
    name: 'PerformanceDataMultipleMetaContext',
    strict: false,
  });
export const useMetricsResultsMeta = _useMetricsResultsMeta;

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
    <_MetricsResultsMetaProvider
      value={{setIsMetricsExtractedData, metricsExtractedDataMap}}
    >
      {children}
    </_MetricsResultsMetaProvider>
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

export function ExtractedMetricsTag(props: {queryKey: MetricsResultsMetaMapKey}) {
  const resultsMeta = useMetricsResultsMeta();
  const organization = useOrganization();
  const _onDemandControl = useOnDemandControl();

  if (!_onDemandControl) {
    return null;
  }

  const {forceOnDemand} = _onDemandControl;

  const isMetricsExtractedData =
    resultsMeta?.metricsExtractedDataMap.get(props.queryKey.id ?? '') || undefined;

  if (!organization.features.includes('on-demand-metrics-extraction-experimental')) {
    // Separate if for easier flag deletion
    return null;
  }

  if (!forceOnDemand || isMetricsExtractedData === undefined) {
    return null;
  }

  if (!isMetricsExtractedData) {
    return <Tag style={{opacity: 0.25}}>{t('not extracted')}</Tag>;
  }
  return (
    <Tag type="info" data-test-id="has-metrics-data-tag">
      {t('extracted')}
    </Tag>
  );
}
