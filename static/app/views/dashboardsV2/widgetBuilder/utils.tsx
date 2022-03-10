import isEqual from 'lodash/isEqual';

import {generateOrderOptions} from 'sentry/components/dashboards/widgetQueriesForm';
import {t} from 'sentry/locale';
import {
  aggregateOutputType,
  getColumnsAndAggregates,
  isAggregateFieldOrEquation,
  isLegalYAxisType,
} from 'sentry/utils/discover/fields';
import {Widget, WidgetQuery, WidgetType} from 'sentry/views/dashboardsV2/types';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

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

export enum SortDirection {
  HIGH_TO_LOW = 'high_to_low',
  LOW_TO_HIGH = 'low_to_high',
}

export const sortDirections = {
  [SortDirection.HIGH_TO_LOW]: t('High to low'),
  [SortDirection.LOW_TO_HIGH]: t('Low to high'),
};

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

export function normalizeQueries({
  displayType,
  queries,
  widgetType,
  widgetBuilderNewDesign = false,
}: {
  displayType: DisplayType;
  queries: Widget['queries'];
  widgetBuilderNewDesign?: boolean;
  widgetType?: Widget['widgetType'];
}): Widget['queries'] {
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
    if (!queries[0].orderby && widgetBuilderNewDesign) {
      const orderBy = (
        widgetType === WidgetType.DISCOVER
          ? generateOrderOptions({
              widgetType,
              widgetBuilderNewDesign,
              ...getColumnsAndAggregates(queries[0].fields),
            })[0].value
          : IssueSortOptions.DATE
      ) as string;
      queries[0].orderby = orderBy;
    }

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
      columns: [],
      aggregates: fields.length ? fields : ['count()'],
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

    const {columns, aggregates} = getColumnsAndAggregates(referenceFields);

    queries = queries.map(query => {
      return {
        ...query,
        columns,
        aggregates,
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
        aggregates: query.aggregates?.slice(0, 1),
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

  const fields = parsedQuery.fields ? getFields(parsedQuery.fields) : [];
  const {columns, aggregates} = getColumnsAndAggregates(fields);

  return {
    ...parsedQuery,
    fields,
    columns,
    aggregates,
  } as WidgetQuery;
}

export function getFields(fieldsString: string): string[] {
  // Use a negative lookahead to avoid splitting on commas inside equation fields
  return fieldsString.split(/,(?![^(]*\))/g);
}
