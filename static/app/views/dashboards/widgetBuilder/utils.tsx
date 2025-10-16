import {t} from 'sentry/locale';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {WidgetType} from 'sentry/views/dashboards/types';

// Used in the widget builder to limit the number of lines plotted in the chart
export const DEFAULT_RESULTS_LIMIT = 5;
const RESULTS_LIMIT = 10;

// Both dashboards and widgets use the 'new' keyword when creating
export const NEW_DASHBOARD_ID = 'new';

export enum DataSet {
  EVENTS = 'events',
  ISSUES = 'issues',
  RELEASES = 'releases',
  METRICS = 'metrics',
  ERRORS = 'error-events',
  TRANSACTIONS = 'transaction-like',
  SPANS = 'spans',
  LOGS = 'ourlogs',
}

export enum SortDirection {
  HIGH_TO_LOW = 'high_to_low',
  LOW_TO_HIGH = 'low_to_high',
}

export const sortDirections = {
  [SortDirection.HIGH_TO_LOW]: t('High to low'),
  [SortDirection.LOW_TO_HIGH]: t('Low to high'),
};

export function getDiscoverDatasetFromWidgetType(widgetType: WidgetType) {
  switch (widgetType) {
    case WidgetType.TRANSACTIONS:
      return DiscoverDatasets.METRICS_ENHANCED;
    case WidgetType.ERRORS:
      return DiscoverDatasets.ERRORS;
    default:
      return undefined;
  }
}

export function getResultsLimit(numQueries: number, numYAxes: number) {
  if (numQueries === 0 || numYAxes === 0) {
    return DEFAULT_RESULTS_LIMIT;
  }

  return Math.floor(RESULTS_LIMIT / (numQueries * numYAxes));
}
