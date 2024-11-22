import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

export const TOP_N = 5;

export enum DisplayModes {
  DEFAULT = 'default',
  PREVIOUS = 'previous',
  TOP5 = 'top5',
  DAILY = 'daily',
  DAILYTOP5 = 'dailytop5',
  BAR = 'bar',
}

export enum DiscoverDatasets {
  DISCOVER = 'discover',
  ERRORS = 'errors',
  METRICS = 'metrics',
  METRICS_ENHANCED = 'metricsEnhanced',
  ISSUE_PLATFORM = 'issuePlatform',
  SPANS_EAP = 'spans',
  SPANS_EAP_RPC = 'spansRpc',
  SPANS_INDEXED = 'spansIndexed',
  SPANS_METRICS = 'spansMetrics',
  TRANSACTIONS = 'transactions',
}

export const DiscoverDatasetsToDatasetMap = {
  [DiscoverDatasets.ERRORS]: Dataset.ERRORS,
  [DiscoverDatasets.TRANSACTIONS]: Dataset.TRANSACTIONS,
};

export enum SavedQueryDatasets {
  DISCOVER = 'discover',
  ERRORS = 'error-events',
  TRANSACTIONS = 'transaction-like',
}

export enum DatasetSource {
  USER = 'user',
  UNKNOWN = 'unknown',
  INFERRED = 'inferred',
  FORCED = 'forced',
}

export const TOP_EVENT_MODES: string[] = [DisplayModes.TOP5, DisplayModes.DAILYTOP5];

// The modes that support the interval selector
export const INTERVAL_DISPLAY_MODES: string[] = [
  DisplayModes.DEFAULT,
  DisplayModes.PREVIOUS,
  DisplayModes.TOP5,
  DisplayModes.BAR,
];

export const DISPLAY_MODE_OPTIONS: SelectValue<string>[] = [
  {value: DisplayModes.DEFAULT, label: t('Total Period')},
  {value: DisplayModes.PREVIOUS, label: t('Previous Period')},
  {value: DisplayModes.TOP5, label: t('Top 5 Period')},
  {value: DisplayModes.DAILY, label: t('Total Daily')},
  {value: DisplayModes.DAILYTOP5, label: t('Top 5 Daily')},
  {value: DisplayModes.BAR, label: t('Bar Chart')},
];

/**
 * The chain of fallback display modes to try to use when one is disabled.
 *
 * Make sure that the chain always leads to a display mode that is enabled.
 * There is a fail safe to fall back to the default display mode, but it likely
 * won't be creating results you expect.
 */
export const DISPLAY_MODE_FALLBACK_OPTIONS = {
  [DisplayModes.DEFAULT]: DisplayModes.DEFAULT,
  [DisplayModes.PREVIOUS]: DisplayModes.DEFAULT,
  [DisplayModes.TOP5]: DisplayModes.DEFAULT,
  [DisplayModes.DAILY]: DisplayModes.DEFAULT,
  [DisplayModes.DAILYTOP5]: DisplayModes.DAILY,
  [DisplayModes.BAR]: DisplayModes.DEFAULT,
};

// default list of yAxis options
export const CHART_AXIS_OPTIONS = [
  {label: 'count()', value: 'count()'},
  {label: 'count_unique(user)', value: 'count_unique(user)'},
];

export const MULTI_Y_AXIS_SUPPORTED_DISPLAY_MODES = [
  DisplayModes.DEFAULT,
  DisplayModes.DAILY,
  DisplayModes.PREVIOUS,
  DisplayModes.BAR,
];

export const CONDITIONS_ARGUMENTS: Array<{value: string; label?: string}> = [
  {
    label: 'is equal to',
    value: 'equals',
  },
  {
    label: 'is not equal to',
    value: 'notEquals',
  },
  {
    label: 'is less than',
    value: 'less',
  },
  {
    label: 'is greater than',
    value: 'greater',
  },
  {
    label: 'is less than or equal to',
    value: 'lessOrEquals',
  },
  {
    label: 'is greater than or equal to',
    value: 'greaterOrEquals',
  },
];

export const WEB_VITALS_QUALITY: Array<{value: string; label?: string}> = [
  {
    label: 'good',
    value: 'good',
  },
  {
    label: 'meh',
    value: 'meh',
  },
  {
    label: 'poor',
    value: 'poor',
  },
  {
    label: 'any',
    value: 'any',
  },
];
