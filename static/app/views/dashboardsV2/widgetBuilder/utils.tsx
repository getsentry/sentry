import isEqual from 'lodash/isEqual';

import {t} from 'sentry/locale';
import {
  aggregateOutputType,
  isAggregateFieldOrEquation,
  isLegalYAxisType,
} from 'sentry/utils/discover/fields';
import {Widget, WidgetQuery} from 'sentry/views/dashboardsV2/types';

export enum DisplayType {
  AREA = 'area',
  BAR = 'bar',
  LINE = 'line',
  TABLE = 'table',
  WORLD_MAP = 'world_map',
  BIG_NUMBER = 'big_number',
  STACKED_AREA = 'stacked_area',
  TOP_N = 'top_n',
}

export enum DataSet {
  EVENTS = 'events',
  ISSUES = 'issues',
  METRICS = 'metrics',
}

export const displayTypes = {
  [DisplayType.AREA]: t('Area Chart'),
  [DisplayType.BAR]: t('Bar Chart'),
  [DisplayType.LINE]: t('Line Chart'),
  [DisplayType.TABLE]: t('Table'),
  [DisplayType.WORLD_MAP]: t('World Map'),
  [DisplayType.BIG_NUMBER]: t('Big Number'),
  [DisplayType.TOP_N]: t('Top 5 Events'),
};

type ValidationError = {
  [key: string]: string | string[] | ValidationError[] | ValidationError;
};

export type FlatValidationError = {
  [key: string]: string | FlatValidationError[] | FlatValidationError;
};

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
      update[key] = (value as ValidationError[]).map(item => mapErrors(item, {}));
    } else {
      update[key] = mapErrors(value as ValidationError, {});
    }
  });

  return update;
}

export function normalizeQueries(
  displayType: DisplayType,
  queries: Widget['queries']
): Widget['queries'] {
  const isTimeseriesChart = [
    DisplayType.LINE,
    DisplayType.AREA,
    DisplayType.STACKED_AREA,
    DisplayType.BAR,
  ].includes(displayType);

  if (
    [DisplayType.TABLE, DisplayType.WORLD_MAP, DisplayType.BIG_NUMBER].includes(
      displayType
    )
  ) {
    // Some display types may only support at most 1 query.
    queries = queries.slice(0, 1);
  } else if (isTimeseriesChart) {
    // Timeseries charts supports at most 3 queries.
    queries = queries.slice(0, 3);
  }

  if ([DisplayType.TABLE, DisplayType.TOP_N].includes(displayType)) {
    return queries;
  }

  // Filter out non-aggregate fields
  queries = queries.map(query => {
    let fields = query.fields.filter(isAggregateFieldOrEquation);

    if (isTimeseriesChart || displayType === DisplayType.WORLD_MAP) {
      // Filter out fields that will not generate numeric output types
      fields = fields.filter(field => isLegalYAxisType(aggregateOutputType(field)));
    }

    if (isTimeseriesChart && fields.length && fields.length > 3) {
      // Timeseries charts supports at most 3 fields.
      fields = fields.slice(0, 3);
    }

    return {
      ...query,
      fields: fields.length ? fields : ['count()'],
    };
  });

  if (isTimeseriesChart) {
    // For timeseries widget, all queries must share identical set of fields.

    const referenceFields = [...queries[0].fields];

    queryLoop: for (const query of queries) {
      if (referenceFields.length >= 3) {
        break;
      }

      if (isEqual(referenceFields, query.fields)) {
        continue;
      }

      for (const field of query.fields) {
        if (referenceFields.length >= 3) {
          break queryLoop;
        }

        if (!referenceFields.includes(field)) {
          referenceFields.push(field);
        }
      }
    }

    queries = queries.map(query => {
      return {
        ...query,
        fields: referenceFields,
      };
    });
  }

  if ([DisplayType.WORLD_MAP, DisplayType.BIG_NUMBER].includes(displayType)) {
    // For world map chart, cap fields of the queries to only one field.
    queries = queries.map(query => {
      return {
        ...query,
        fields: query.fields.slice(0, 1),
      };
    });
  }

  return queries;
}

export function getParsedDefaultWidgetQuery(query = ''): WidgetQuery | undefined {
  // "any" was needed here because it doesn't pass in getsentry
  const urlSeachParams = new URLSearchParams(query) as any;
  const parsedQuery = Object.fromEntries(urlSeachParams.entries());

  if (!Object.keys(parsedQuery).length) {
    return undefined;
  }

  return {
    ...parsedQuery,
    fields: parsedQuery.fields?.split(',') ?? [],
  } as WidgetQuery;
}
