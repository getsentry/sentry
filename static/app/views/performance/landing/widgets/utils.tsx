import type {Organization} from 'sentry/types/organization';
import localStorage from 'sentry/utils/localStorage';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import type {MetricsEnhancedSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {
  canUseMetricsData,
  MEPState,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';

import type {ProjectPerformanceType} from '../../utils';

import {PerformanceWidgetSetting} from './widgetDefinitions';

export const QUERY_LIMIT_PARAM = 4;

export const TOTAL_EXPANDABLE_ROWS_HEIGHT = 37 * QUERY_LIMIT_PARAM;

export const eventsRequestQueryProps = [
  'children',
  'organization',
  'yAxis',
  'period',
  'start',
  'end',
  'environment',
  'project',
  'referrer',
] as const;

function setWidgetStorageObject(localObject: Record<string, string>) {
  localStorage.setItem(getContainerLocalStorageObjectKey, JSON.stringify(localObject));
}

const mepQueryParamBase: Record<string, string> = {};

export function getMEPQueryParams(
  mepContext: MetricsEnhancedSettingContext,
  forceAuto?: boolean
) {
  let queryParams: Record<string, string> = {};
  const base = mepQueryParamBase;
  if (mepContext.shouldQueryProvideMEPAutoParams || forceAuto) {
    queryParams = {
      ...queryParams,
      ...base,
      dataset: 'metricsEnhanced',
    };
    if (forceAuto) {
      return queryParams;
    }
  }
  if (mepContext.shouldQueryProvideMEPTransactionParams) {
    queryParams = {...queryParams, ...base, dataset: 'discover'};
  }
  if (mepContext.shouldQueryProvideMEPMetricParams) {
    queryParams = {...queryParams, ...base, dataset: 'metrics'};
  }

  // Disallow any performance request from using aggregates since they aren't currently possible in all visualizations and we don't want to mix modes.
  return isEmptyObject(queryParams) ? undefined : queryParams;
}

export function getMetricOnlyQueryParams() {
  return {...mepQueryParamBase, dataset: 'metrics'};
}

export const WIDGET_MAP_DENY_LIST = [
  PerformanceWidgetSetting.MOST_RELATED_ERRORS,
  PerformanceWidgetSetting.MOST_RELATED_ISSUES,
];

/**
 * Some widgets, such as Related Issues, are inherently not possible w/ metrics at the moment since they use event.type:error under the hood.
 */
export function getMEPParamsIfApplicable(
  mepContext: MetricsEnhancedSettingContext,
  widget: PerformanceWidgetSetting
) {
  if (WIDGET_MAP_DENY_LIST.includes(widget)) {
    return undefined;
  }
  return getMEPQueryParams(mepContext);
}

const getContainerLocalStorageObjectKey = 'landing-chart-container';
const getContainerKey = (
  index: number,
  performanceType: ProjectPerformanceType,
  height: number
) => `landing-chart-container#${performanceType}#${height}#${index}`;

function getWidgetStorageObject() {
  const localObject = JSON.parse(
    localStorage.getItem(getContainerLocalStorageObjectKey) || '{}'
  );
  return localObject;
}

export const getChartSetting = (
  index: number,
  height: number,
  performanceType: ProjectPerformanceType,
  defaultType: PerformanceWidgetSetting,
  forceDefaultChartSetting?: boolean // Used for testing.
): PerformanceWidgetSetting => {
  if (forceDefaultChartSetting) {
    return defaultType;
  }
  const key = getContainerKey(index, performanceType, height);
  const localObject = getWidgetStorageObject();
  const value = localObject?.[key];

  if (
    value &&
    Object.values(PerformanceWidgetSetting).includes(value as PerformanceWidgetSetting)
  ) {
    const _value: PerformanceWidgetSetting = value as PerformanceWidgetSetting;
    return _value;
  }
  return defaultType;
};
export const _setChartSetting = (
  index: number,
  height: number,
  performanceType: ProjectPerformanceType,
  setting: PerformanceWidgetSetting
) => {
  const key = getContainerKey(index, performanceType, height);
  const localObject = getWidgetStorageObject();
  localObject[key] = setting;

  setWidgetStorageObject(localObject);
};

const DISALLOWED_CHARTS_METRICS = [
  PerformanceWidgetSetting.DURATION_HISTOGRAM,
  PerformanceWidgetSetting.FCP_HISTOGRAM,
  PerformanceWidgetSetting.LCP_HISTOGRAM,
  PerformanceWidgetSetting.FID_HISTOGRAM,
];

export function filterAllowedChartsMetrics(
  organization: Organization,
  allowedCharts: PerformanceWidgetSetting[],
  mepSetting: MetricsEnhancedSettingContext
) {
  if (
    !canUseMetricsData(organization) ||
    organization.features.includes('performance-mep-reintroduce-histograms') ||
    mepSetting.metricSettingState === MEPState.TRANSACTIONS_ONLY
  ) {
    return allowedCharts;
  }

  return allowedCharts.filter(c => !DISALLOWED_CHARTS_METRICS.includes(c));
}
