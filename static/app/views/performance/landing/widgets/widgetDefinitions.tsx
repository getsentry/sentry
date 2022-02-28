import CHART_PALETTE from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {TransactionMetric} from 'sentry/utils/metrics/fields';

import {getTermHelp, PERFORMANCE_TERM} from '../../data';

import {GenericPerformanceWidgetDataType} from './types';

export interface ChartDefinition {
  dataType: GenericPerformanceWidgetDataType;
  fields: string[];

  title: string;
  titleTooltip: string; // The first field in the list will be treated as the primary field in most widgets (except for special casing).

  chartColor?: string; // Optional. Will default to colors depending on placement in list or colors from the chart itself.

  vitalStops?: {
    meh: number;
    poor: number;
  };
}

export enum PerformanceWidgetSetting {
  DURATION_HISTOGRAM = 'duration_histogram',
  LCP_HISTOGRAM = 'lcp_histogram',
  FCP_HISTOGRAM = 'fcp_histogram',
  FID_HISTOGRAM = 'fid_histogram',
  APDEX_AREA = 'apdex_area',
  P50_DURATION_AREA = 'p50_duration_area',
  P75_DURATION_AREA = 'p75_duration_area',
  P95_DURATION_AREA = 'p95_duration_area',
  P99_DURATION_AREA = 'p99_duration_area',
  P75_LCP_AREA = 'p75_lcp_area',
  TPM_AREA = 'tpm_area',
  FAILURE_RATE_AREA = 'failure_rate_area',
  USER_MISERY_AREA = 'user_misery_area',
  WORST_LCP_VITALS = 'worst_lcp_vitals',
  WORST_FCP_VITALS = 'worst_fcp_vitals',
  WORST_CLS_VITALS = 'worst_cls_vitals',
  WORST_FID_VITALS = 'worst_fid_vitals',
  MOST_IMPROVED = 'most_improved',
  MOST_REGRESSED = 'most_regressed',
  MOST_RELATED_ERRORS = 'most_related_errors',
  MOST_RELATED_ISSUES = 'most_related_issues',
  SLOW_HTTP_OPS = 'slow_http_ops',
  SLOW_DB_OPS = 'slow_db_ops',
  SLOW_RESOURCE_OPS = 'slow_resource_ops',
  SLOW_BROWSER_OPS = 'slow_browser_ops',
  COLD_STARTUP_AREA = 'cold_startup_area',
  WARM_STARTUP_AREA = 'warm_startup_area',
  SLOW_FRAMES_AREA = 'slow_frames_area',
  FROZEN_FRAMES_AREA = 'frozen_frames_area',
  MOST_SLOW_FRAMES = 'most_slow_frames',
  MOST_FROZEN_FRAMES = 'most_frozen_frames',
}

const WIDGET_PALETTE = CHART_PALETTE[5];
export const WIDGET_DEFINITIONS: ({
  organization,
  isMetricsData,
}: {
  organization: Organization;
  isMetricsData?: boolean;
}) => Record<PerformanceWidgetSetting, ChartDefinition> = ({
  organization,
  isMetricsData,
}: {
  organization: Organization;
  isMetricsData?: boolean;
}) => ({
  [PerformanceWidgetSetting.DURATION_HISTOGRAM]: {
    title: t('Duration Distribution'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
    fields: ['transaction.duration'],
    dataType: GenericPerformanceWidgetDataType.histogram,
    chartColor: WIDGET_PALETTE[5],
  },
  [PerformanceWidgetSetting.LCP_HISTOGRAM]: {
    title: t('LCP Distribution'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
    fields: ['measurements.lcp'],
    dataType: GenericPerformanceWidgetDataType.histogram,
    chartColor: WIDGET_PALETTE[5],
  },
  [PerformanceWidgetSetting.FCP_HISTOGRAM]: {
    title: t('FCP Distribution'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
    fields: ['measurements.fcp'],
    dataType: GenericPerformanceWidgetDataType.histogram,
    chartColor: WIDGET_PALETTE[5],
  },
  [PerformanceWidgetSetting.FID_HISTOGRAM]: {
    title: t('FID Distribution'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
    fields: ['measurements.fid'],
    dataType: GenericPerformanceWidgetDataType.histogram,
    chartColor: WIDGET_PALETTE[5],
  },
  [PerformanceWidgetSetting.WORST_LCP_VITALS]: {
    title: t('Worst LCP Web Vitals'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.LCP),
    fields: isMetricsData
      ? [`count(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_LCP})`]
      : ['measurements.lcp'],
    vitalStops: {
      poor: 4000,
      meh: 2500,
    },
    dataType: GenericPerformanceWidgetDataType.vitals,
  },
  [PerformanceWidgetSetting.WORST_FCP_VITALS]: {
    title: t('Worst FCP Web Vitals'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.FCP),
    fields: isMetricsData
      ? [`count(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FCP})`]
      : ['measurements.fcp'],
    vitalStops: {
      poor: 3000,
      meh: 1000,
    },
    dataType: GenericPerformanceWidgetDataType.vitals,
  },
  [PerformanceWidgetSetting.WORST_FID_VITALS]: {
    title: t('Worst FID Web Vitals'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.FID),
    fields: isMetricsData
      ? [`count(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FID})`]
      : ['measurements.fid'],
    vitalStops: {
      poor: 300,
      meh: 100,
    },
    dataType: GenericPerformanceWidgetDataType.vitals,
  },
  [PerformanceWidgetSetting.WORST_CLS_VITALS]: {
    title: t('Worst CLS Web Vitals'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.CLS),
    fields: isMetricsData
      ? [`count(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_CLS})`]
      : ['measurements.cls'],
    vitalStops: {
      poor: 0.25,
      meh: 0.1,
    },
    dataType: GenericPerformanceWidgetDataType.vitals,
  },
  [PerformanceWidgetSetting.TPM_AREA]: {
    title: t('Transactions Per Minute'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.TPM),
    fields: isMetricsData
      ? [`count(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`]
      : ['tpm()'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[1],
  },
  [PerformanceWidgetSetting.APDEX_AREA]: {
    title: t('Apdex'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.APDEX),
    fields: ['apdex()'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[4],
  },
  [PerformanceWidgetSetting.P50_DURATION_AREA]: {
    title: t('p50 Duration'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.P50),
    fields: isMetricsData
      ? [`p50(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`]
      : ['p50(transaction.duration)'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[3],
  },
  [PerformanceWidgetSetting.P75_DURATION_AREA]: {
    title: t('p75 Duration'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.P75),
    fields: isMetricsData
      ? [`p75(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`]
      : ['p75(transaction.duration)'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[3],
  },
  [PerformanceWidgetSetting.P95_DURATION_AREA]: {
    title: t('p95 Duration'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.P95),
    fields: isMetricsData
      ? [`p95(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`]
      : ['p95(transaction.duration)'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[3],
  },
  [PerformanceWidgetSetting.P99_DURATION_AREA]: {
    title: t('p99 Duration'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.P99),
    fields: isMetricsData
      ? [`p99(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`]
      : ['p99(transaction.duration)'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[3],
  },
  [PerformanceWidgetSetting.P75_LCP_AREA]: {
    title: t('p75 LCP'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.P75),
    fields: isMetricsData
      ? [`p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_LCP})`]
      : ['p75(measurements.lcp)'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[1],
  },
  [PerformanceWidgetSetting.FAILURE_RATE_AREA]: {
    title: t('Failure Rate'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.FAILURE_RATE),
    fields: isMetricsData
      ? [`count(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`]
      : ['failure_rate()'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[2],
  },
  [PerformanceWidgetSetting.USER_MISERY_AREA]: {
    title: t('User Misery'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.USER_MISERY),
    fields: [`user_misery()`],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[0],
  },
  [PerformanceWidgetSetting.COLD_STARTUP_AREA]: {
    title: t('Cold Startup Time'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_COLD),
    fields: isMetricsData
      ? [`p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_APP_START_COLD})`]
      : ['p75(measurements.app_start_cold)'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[4],
  },
  [PerformanceWidgetSetting.WARM_STARTUP_AREA]: {
    title: t('Warm Startup Time'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_WARM),
    fields: isMetricsData
      ? [`p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_APP_START_WARM})`]
      : ['p75(measurements.app_start_warm)'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[3],
  },
  [PerformanceWidgetSetting.SLOW_FRAMES_AREA]: {
    title: t('Slow Frames'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.SLOW_FRAMES),
    fields: isMetricsData
      ? [`p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_SLOW_RATE})`]
      : ['p75(measurements.frames_slow_rate)'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[0],
  },
  [PerformanceWidgetSetting.FROZEN_FRAMES_AREA]: {
    title: t('Frozen Frames'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.FROZEN_FRAMES),
    fields: isMetricsData
      ? [`p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_FROZEN_RATE})`]
      : ['p75(measurements.frames_frozen_rate)'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[5],
  },
  [PerformanceWidgetSetting.MOST_RELATED_ERRORS]: {
    title: t('Most Related Errors'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.MOST_ERRORS),
    fields: [`failure_count()`],
    dataType: GenericPerformanceWidgetDataType.line_list,
    chartColor: WIDGET_PALETTE[0],
  },
  [PerformanceWidgetSetting.MOST_RELATED_ISSUES]: {
    title: t('Most Related Issues'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.MOST_ISSUES),
    fields: [`count()`],
    dataType: GenericPerformanceWidgetDataType.line_list,
    chartColor: WIDGET_PALETTE[0],
  },
  [PerformanceWidgetSetting.SLOW_HTTP_OPS]: {
    title: t('Slow HTTP Ops'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.SLOW_HTTP_SPANS),
    fields: [`p75(spans.http)`],
    dataType: GenericPerformanceWidgetDataType.line_list,
    chartColor: WIDGET_PALETTE[0],
  },
  [PerformanceWidgetSetting.SLOW_BROWSER_OPS]: {
    title: t('Slow Browser Ops'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.SLOW_HTTP_SPANS),
    fields: [`p75(spans.browser)`],
    dataType: GenericPerformanceWidgetDataType.line_list,
    chartColor: WIDGET_PALETTE[0],
  },
  [PerformanceWidgetSetting.SLOW_RESOURCE_OPS]: {
    title: t('Slow Resource Ops'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.SLOW_HTTP_SPANS),
    fields: [`p75(spans.resource)`],
    dataType: GenericPerformanceWidgetDataType.line_list,
    chartColor: WIDGET_PALETTE[0],
  },
  [PerformanceWidgetSetting.SLOW_DB_OPS]: {
    title: t('Slow DB Ops'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.SLOW_HTTP_SPANS),
    fields: [`p75(spans.db)`],
    dataType: GenericPerformanceWidgetDataType.line_list,
    chartColor: WIDGET_PALETTE[0],
  },
  [PerformanceWidgetSetting.MOST_SLOW_FRAMES]: {
    title: t('Most Slow Frames'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.SLOW_FRAMES),
    fields: isMetricsData
      ? [`avg(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_SLOW})`]
      : ['avg(measurements.frames_slow)'],
    dataType: GenericPerformanceWidgetDataType.line_list,
    chartColor: WIDGET_PALETTE[0],
  },
  [PerformanceWidgetSetting.MOST_FROZEN_FRAMES]: {
    title: t('Most Frozen Frames'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.FROZEN_FRAMES),
    fields: isMetricsData
      ? [`avg(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_FROZEN})`]
      : ['avg(measurements.frames_frozen)'],
    dataType: GenericPerformanceWidgetDataType.line_list,
    chartColor: WIDGET_PALETTE[0],
  },
  [PerformanceWidgetSetting.MOST_IMPROVED]: {
    title: t('Most Improved'),
    titleTooltip: t(
      'This compares the baseline (%s) of the past with the present.',
      'improved'
    ),
    fields: [],
    dataType: GenericPerformanceWidgetDataType.trends,
  },
  [PerformanceWidgetSetting.MOST_REGRESSED]: {
    title: t('Most Regressed'),
    titleTooltip: t(
      'This compares the baseline (%s) of the past with the present.',
      'regressed'
    ),
    fields: [],
    dataType: GenericPerformanceWidgetDataType.trends,
  },
});
