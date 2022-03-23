import isEqual from 'lodash/isEqual';

import {generateOrderOptions} from 'sentry/components/dashboards/widgetQueriesForm';
import {t} from 'sentry/locale';
import {Organization, TagCollection} from 'sentry/types';
import {aggregateOutputType, isLegalYAxisType} from 'sentry/utils/discover/fields';
import {MeasurementCollection} from 'sentry/utils/measurements/measurements';
import {SPAN_OP_BREAKDOWN_FIELDS} from 'sentry/utils/performance/spanOperationBreakdowns/constants';
import {
  DisplayType,
  Widget,
  WidgetQuery,
  WidgetType,
} from 'sentry/views/dashboardsV2/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

// Used in the widget builder to limit the number of lines plotted in the chart
export const DEFAULT_RESULTS_LIMIT = 5;
export const RESULTS_LIMIT = 10;

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
    DisplayType.BAR,
  ].includes(displayType);

  const isTabularChart = [DisplayType.TABLE, DisplayType.TOP_N].includes(displayType);

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

  if (widgetBuilderNewDesign) {
    queries = queries.map(query => {
      const {fields = [], columns} = query;

      if (isTabularChart) {
        // If the groupBy field has values, port everything over to the columnEditCollect field.
        query.fields = [...new Set([...fields, ...columns])];
      } else {
        // If columnEditCollect has field values , port everything over to the groupBy field.
        query.fields = fields.filter(field => !columns.includes(field));
      }

      if (!!query.orderby) {
        return query;
      }

      const orderBy =
        queries[0].orderby ||
        (widgetType === WidgetType.DISCOVER
          ? generateOrderOptions({
              widgetType,
              widgetBuilderNewDesign,
              columns: queries[0].columns,
              aggregates: queries[0].aggregates,
            })[0].value
          : IssueSortOptions.DATE);

      // Issues data set doesn't support order by descending
      query.orderby =
        widgetType === WidgetType.DISCOVER ? `-${String(orderBy)}` : String(orderBy);

      return query;
    });
  }

  if (isTabularChart) {
    return queries;
  }

  // Filter out non-aggregate fields
  queries = queries.map(query => {
    let aggregates = query.aggregates;

    if (isTimeseriesChart || displayType === DisplayType.WORLD_MAP) {
      // Filter out fields that will not generate numeric output types
      aggregates = aggregates.filter(aggregate =>
        isLegalYAxisType(aggregateOutputType(aggregate))
      );
    }

    if (isTimeseriesChart && aggregates.length && aggregates.length > 3) {
      // Timeseries charts supports at most 3 fields.
      aggregates = aggregates.slice(0, 3);
    }

    return {
      ...query,
      fields: aggregates.length ? aggregates : ['count()'],
      columns: widgetBuilderNewDesign && query.columns ? query.columns : [],
      aggregates: aggregates.length ? aggregates : ['count()'],
    };
  });

  if (isTimeseriesChart) {
    // For timeseries widget, all queries must share identical set of fields.

    const referenceAggregates = [...queries[0].aggregates];

    queryLoop: for (const query of queries) {
      if (referenceAggregates.length >= 3) {
        break;
      }

      if (isEqual(referenceAggregates, query.aggregates)) {
        continue;
      }

      for (const aggregate of query.aggregates) {
        if (referenceAggregates.length >= 3) {
          break queryLoop;
        }

        if (!referenceAggregates.includes(aggregate)) {
          referenceAggregates.push(aggregate);
        }
      }
    }

    queries = queries.map(query => {
      return {
        ...query,
        columns: widgetBuilderNewDesign && query.columns ? query.columns : [],
        aggregates: referenceAggregates,
        fields: referenceAggregates,
      };
    });
  }

  if ([DisplayType.WORLD_MAP, DisplayType.BIG_NUMBER].includes(displayType)) {
    // For world map chart, cap fields of the queries to only one field.
    queries = queries.map(query => {
      return {
        ...query,
        fields: query.aggregates.slice(0, 1),
        aggregates: query.aggregates.slice(0, 1),
        orderby: '',
        columns: [],
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

  const columns = parsedQuery.columns ? getFields(parsedQuery.columns) : [];
  const aggregates = parsedQuery.aggregates ? getFields(parsedQuery.aggregates) : [];
  const fields = [...columns, ...aggregates];

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

export function getAmendedFieldOptions({
  measurements,
  organization,
  tags,
}: {
  measurements: MeasurementCollection;
  organization: Organization;
  tags: TagCollection;
}) {
  return generateFieldOptions({
    organization,
    tagKeys: Object.values(tags).map(({key}) => key),
    measurementKeys: Object.values(measurements).map(({key}) => key),
    spanOperationBreakdownKeys: SPAN_OP_BREAKDOWN_FIELDS,
  });
}
