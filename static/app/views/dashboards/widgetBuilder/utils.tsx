import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {WidgetType} from 'sentry/views/dashboards/types';
import type {FlatValidationError, ValidationError} from 'sentry/views/dashboards/utils';

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

export function mapErrors(
  data: ValidationError,
  update: FlatValidationError
): FlatValidationError {
  Object.keys(data).forEach((key: string) => {
    const value = data[key];
    if (typeof value === 'string') {
      update[key] = value;
      return;
    }
    // Recurse into nested objects.
    if (Array.isArray(value) && typeof value[0] === 'string') {
      update[key] = value[0];
      return;
    }
    if (Array.isArray(value) && typeof value[0] === 'object') {
      update[key] = (value as ValidationError[])
        .filter(defined)
        .map(item => mapErrors(item, {}));
    } else {
      update[key] = mapErrors(value as ValidationError, {});
    }
  });

  return update;
}

export function getFields(fieldsString: string): string[] {
  // Use a negative lookahead to avoid splitting on commas inside equation fields
  return fieldsString.split(/,(?![^(]*\))/g);
}

export function getResultsLimit(numQueries: number, numYAxes: number) {
  if (numQueries === 0 || numYAxes === 0) {
    return DEFAULT_RESULTS_LIMIT;
  }

  return Math.floor(RESULTS_LIMIT / (numQueries * numYAxes));
}
