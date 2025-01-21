import {defined} from 'sentry/utils';
import {generateFieldAsString, type Sort} from 'sentry/utils/discover/fields';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {
  DisplayType,
  type Widget,
  type WidgetQuery,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';

import type {WidgetBuilderState} from '../hooks/useWidgetBuilderState';

export function convertBuilderStateToWidget(state: WidgetBuilderState): Widget {
  const datasetConfig = getDatasetConfig(state.dataset ?? WidgetType.ERRORS);
  const defaultQuery = datasetConfig.defaultWidgetQuery;

  const queries = defined(state.query) && state.query.length > 0 ? state.query : [''];
  const legendAlias =
    defined(state.legendAlias) && state.legendAlias.length > 0 ? state.legendAlias : [];

  const fieldAliases = state.fields?.map(field => field.alias ?? '');
  const aggregates =
    (state.yAxis?.length ?? 0) > 0
      ? state.yAxis?.map(generateFieldAsString)
      : state.fields
          ?.filter(field =>
            [FieldValueKind.FUNCTION, FieldValueKind.EQUATION].includes(
              field.kind as FieldValueKind
            )
          )
          .map(generateFieldAsString);
  const columns = state.fields
    ?.filter(field => field.kind === FieldValueKind.FIELD)
    .map(generateFieldAsString);

  const fields =
    state.displayType === DisplayType.TABLE
      ? state.fields?.map(generateFieldAsString)
      : [...(columns ?? []), ...(aggregates ?? [])];

  // If there's no sort, use the first field as the default sort
  const defaultSort = fields?.[0] ?? defaultQuery.orderby;
  const sort =
    defined(state.sort) && state.sort.length > 0
      ? _formatSort(state.sort[0]!)
      : defaultSort;

  const widgetQueries: WidgetQuery[] = queries.map((query, index) => {
    return {
      ...defaultQuery,
      fields,
      aggregates: aggregates ?? [],
      columns: columns ?? [],
      conditions: query,
      orderby: sort,
      fieldAliases: fieldAliases ?? [],
      name: legendAlias[index] ?? '',
      selectedAggregate: state.selectedAggregate,
    };
  });

  return {
    title: state.title ?? '',
    description: state.description,
    displayType: state.displayType ?? DisplayType.TABLE,
    interval: '1h', // TODO: Not sure what to put here yet
    queries: widgetQueries,
    widgetType: state.dataset,
    limit: state.limit,
    thresholds: state.thresholds,
  };
}

function _formatSort(sort: Sort): string {
  const direction = sort.kind === 'desc' ? '-' : '';
  return `${direction}${sort.field}`;
}
