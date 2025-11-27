import {defined} from 'sentry/utils';
import {generateFieldAsString} from 'sentry/utils/discover/fields';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {
  DisplayType,
  WidgetType,
  type Widget,
  type WidgetQuery,
} from 'sentry/views/dashboards/types';
import {isChartDisplayType} from 'sentry/views/dashboards/utils';
import {
  serializeSorts,
  type WidgetBuilderState,
} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {FieldValueKind} from 'sentry/views/discover/table/types';

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
          .map(generateFieldAsString)
          .filter(Boolean);
  const columns = state.fields
    ?.filter(field => field.kind === FieldValueKind.FIELD)
    .map(generateFieldAsString)
    .filter(Boolean);

  const fields =
    state.displayType === DisplayType.TABLE || state.displayType === DisplayType.DETAILS
      ? state.fields?.map(generateFieldAsString)
      : [...(columns ?? []), ...(aggregates ?? [])];

  // If there's no sort, use the first field as the default sort (this doesn't apply to release table widgets)
  const defaultSort =
    state.displayType === DisplayType.TABLE && state.dataset === WidgetType.RELEASE
      ? ''
      : (fields?.[0] ?? defaultQuery.orderby);
  const sort =
    defined(state.sort) && state.sort.length > 0
      ? serializeSorts(state.dataset)(state.sort)[0]!
      : defaultSort;

  const widgetQueries: WidgetQuery[] = queries.map((query, index) => {
    return {
      ...defaultQuery,
      fields,
      aggregates: aggregates ?? [],
      columns: columns ?? [],
      conditions: query,
      fieldAliases: fieldAliases ?? [],
      name: legendAlias[index] ?? '',
      selectedAggregate: state.selectedAggregate,
      linkedDashboards: state.linkedDashboards ?? [],
      // Big number widgets don't support sorting, so always ignore the sort state
      orderby: state.displayType === DisplayType.BIG_NUMBER ? '' : sort,
    };
  });

  const limit = isChartDisplayType(state.displayType) ? state.limit : undefined;
  return {
    title: state.title ?? '',
    description: state.description,
    displayType: state.displayType ?? DisplayType.TABLE,
    interval: '1h', // TODO: Not sure what to put here yet
    queries: widgetQueries,
    widgetType: state.dataset,
    limit,
    thresholds: state.thresholds,
  };
}
