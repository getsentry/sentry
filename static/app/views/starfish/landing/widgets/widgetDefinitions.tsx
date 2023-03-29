import CHART_PALETTE from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';

import {getTermHelp, PERFORMANCE_TERM} from '../../data';

import {GenericPerformanceWidgetDataType} from './types';

export interface ChartDefinition {
  dataType: GenericPerformanceWidgetDataType;
  fields: string[];

  title: string;
  titleTooltip: string; // The first field in the list will be treated as the primary field in most widgets (except for special casing).

  allowsOpenInDiscover?: boolean;
  chartColor?: string; // Optional. Will default to colors depending on placement in list or colors from the chart itself.

  vitalStops?: {
    meh: number;
    poor: number;
  };
}

export enum PerformanceWidgetSetting {
  TPM_AREA = 'tpm_area',
  FAILURE_RATE_AREA = 'failure_rate_area',
  P50_DURATION_AREA = 'p50_duration_area',
  P75_DURATION_AREA = 'p75_duration_area',
  P95_DURATION_AREA = 'p95_duration_area',
  P99_DURATION_AREA = 'p99_duration_area',
  DB_HTTP_BREAKDOWN = 'db_http_breakdown',
}

const WIDGET_PALETTE = CHART_PALETTE[5];
export const WIDGET_DEFINITIONS: ({
  organization,
}: {
  organization: Organization;
}) => Record<PerformanceWidgetSetting, ChartDefinition> = ({
  organization,
}: {
  organization: Organization;
}) => ({
  [PerformanceWidgetSetting.TPM_AREA]: {
    title: t('Transactions Per Minute'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.TPM),
    fields: ['tpm()'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[1],
    allowsOpenInDiscover: true,
  },
  [PerformanceWidgetSetting.P50_DURATION_AREA]: {
    title: t('p50 Duration'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.P50),
    fields: ['p50(transaction.duration)'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[3],
    allowsOpenInDiscover: true,
  },
  [PerformanceWidgetSetting.P75_DURATION_AREA]: {
    title: t('p75 Duration'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.P75),
    fields: ['p75(transaction.duration)'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[3],
    allowsOpenInDiscover: true,
  },
  [PerformanceWidgetSetting.P95_DURATION_AREA]: {
    title: t('p95 Duration'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.P95),
    fields: ['p95(transaction.duration)'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[3],
    allowsOpenInDiscover: true,
  },
  [PerformanceWidgetSetting.P99_DURATION_AREA]: {
    title: t('p99 Duration'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.P99),
    fields: ['p99(transaction.duration)'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[3],
    allowsOpenInDiscover: true,
  },
  [PerformanceWidgetSetting.FAILURE_RATE_AREA]: {
    title: t('Error Rate'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.FAILURE_RATE),
    fields: ['failure_rate()'],
    dataType: GenericPerformanceWidgetDataType.area,
    chartColor: WIDGET_PALETTE[2],
    allowsOpenInDiscover: true,
  },
  [PerformanceWidgetSetting.DB_HTTP_BREAKDOWN]: {
    title: t('Operation Breakdown'),
    titleTooltip: getTermHelp(organization, PERFORMANCE_TERM.FAILURE_RATE),
    fields: ['p95(spans.db)', 'p95(spans.http)'],
    dataType: GenericPerformanceWidgetDataType.stacked_area,
    allowsOpenInDiscover: true,
  },
});
