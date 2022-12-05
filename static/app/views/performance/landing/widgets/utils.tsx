import {Organization} from 'sentry/types';
import {objectIsEmpty} from 'sentry/utils';
import localStorage from 'sentry/utils/localStorage';
import {
  canUseMetricsData,
  MEPState,
  MetricsEnhancedSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';

import {PROJECT_PERFORMANCE_TYPE} from '../../utils';

import {PerformanceWidgetSetting} from './widgetDefinitions';

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

const mepQueryParamBase = {};

export function getMEPQueryParams(mepContext: MetricsEnhancedSettingContext) {
  let queryParams = {};
  const base = mepQueryParamBase;
  if (mepContext.shouldQueryProvideMEPAutoParams) {
    queryParams = {
      ...queryParams,
      ...base,
      dataset: 'metricsEnhanced',
    };
  }
  if (mepContext.shouldQueryProvideMEPTransactionParams) {
    queryParams = {...queryParams, ...base, dataset: 'discover'};
  }
  if (mepContext.shouldQueryProvideMEPMetricParams) {
    queryParams = {...queryParams, ...base, dataset: 'metrics'};
  }

  // Disallow any performance request from using aggregates since they aren't currently possible in all visualizations and we don't want to mix modes.
  return objectIsEmpty(queryParams) ? undefined : queryParams;
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
  performanceType: PROJECT_PERFORMANCE_TYPE,
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
  performanceType: PROJECT_PERFORMANCE_TYPE,
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
  performanceType: PROJECT_PERFORMANCE_TYPE,
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
    mepSetting.metricSettingState === MEPState.transactionsOnly
  ) {
    return allowedCharts;
  }

  return allowedCharts.filter(c => !DISALLOWED_CHARTS_METRICS.includes(c));
}
