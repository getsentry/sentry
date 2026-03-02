import {defined} from 'sentry/utils';
import {
  generateFieldAsString,
  getEquation,
  isEquation,
} from 'sentry/utils/discover/fields';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {
  DisplayType,
  WidgetType,
  type Widget,
  type WidgetQuery,
} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {
  serializeSorts,
  type WidgetBuilderState,
} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {generateMetricAggregate} from 'sentry/views/dashboards/widgetBuilder/utils/generateMetricAggregate';
import {FieldValueKind} from 'sentry/views/discover/table/types';

/**
 * Resolves the selected aggregate index, defaulting to the last aggregate.
 */
export function getSelectedAggregateIndex(
  selectedAggregate: number | undefined,
  aggregateCount: number
): number {
  if (selectedAggregate === undefined) {
    return aggregateCount > 0 ? aggregateCount - 1 : 0;
  }
  return Math.min(selectedAggregate, Math.max(0, aggregateCount - 1));
}

export function convertBuilderStateToWidget(state: WidgetBuilderState): Widget {
  const datasetConfig = getDatasetConfig(state.dataset ?? WidgetType.ERRORS);
  const defaultQuery = datasetConfig.defaultWidgetQuery;

  const queries = defined(state.query) && state.query.length > 0 ? state.query : [''];
  const legendAlias =
    defined(state.legendAlias) && state.legendAlias.length > 0 ? state.legendAlias : [];

  const fieldAliases = state.fields?.map(field => field.alias ?? '');
  let aggregates: string[];

  if (
    state.dataset === WidgetType.TRACEMETRICS &&
    (state.displayType === DisplayType.BIG_NUMBER ||
      usesTimeSeriesData(state.displayType))
  ) {
    // HACK: Inject the trace metric name and type into the aggregate function
    // prior to making the request because the current types for y-axes do not support
    // the correct number of arguments required for trace metrics
    const aggregateSource = state.yAxis?.length ? state.yAxis : state.fields;
    aggregates =
      aggregateSource?.map(axis => {
        const traceMetric = state.traceMetric ?? {name: '', type: ''};
        if (axis.kind === 'function') {
          return generateMetricAggregate(traceMetric, axis);
        }
        return axis.field;
      }) ?? [];
  } else if (state.yAxis?.length) {
    aggregates =
      state.yAxis
        ?.map(generateFieldAsString)
        .filter(f => !isEquation(f) || getEquation(f).trim() !== '') ?? [];
  } else {
    aggregates =
      state.fields
        ?.filter(field =>
          [FieldValueKind.FUNCTION, FieldValueKind.EQUATION].includes(
            field.kind as FieldValueKind
          )
        )
        .map(generateFieldAsString)
        .filter(f => f && (!isEquation(f) || getEquation(f).trim() !== '')) ?? [];
  }

  const columns = state.fields
    ?.filter(field => field.kind === FieldValueKind.FIELD)
    .map(generateFieldAsString)
    .filter(Boolean);

  const fields =
    state.displayType === DisplayType.TABLE ||
    state.displayType === DisplayType.DETAILS ||
    state.displayType === DisplayType.BIG_NUMBER
      ? state.dataset === WidgetType.TRACEMETRICS
        ? state.fields?.map(field => {
            const traceMetric = state.traceMetric ?? {name: '', type: ''};
            if (field.kind === 'function') {
              return generateMetricAggregate(traceMetric, field);
            }
            return generateFieldAsString(field);
          })
        : state.fields?.map(generateFieldAsString)
      : [...(columns ?? []), ...(aggregates ?? [])];

  // If there's no sort, use a sensible default based on display type
  const isReleaseTable =
    state.displayType === DisplayType.TABLE && state.dataset === WidgetType.RELEASE;
  const isCategoricalBar = state.displayType === DisplayType.CATEGORICAL_BAR;

  let defaultSort = fields?.[0] ?? defaultQuery.orderby;
  if (isReleaseTable) {
    defaultSort = '';
  } else if (isCategoricalBar) {
    // Categorical bars should sort by the selected aggregate (last by default, matching Big Number).
    // For equations, use the alias format (equation[N]) that the API expects, not the raw equation|... string
    const selectedIndex = getSelectedAggregateIndex(
      state.selectedAggregate,
      aggregates.length
    );
    const selectedAggregate = aggregates[selectedIndex] ?? aggregates[0];
    if (selectedAggregate) {
      if (isEquation(selectedAggregate)) {
        const equationIndex =
          aggregates.slice(0, selectedIndex + 1).filter(isEquation).length - 1;
        // Defensive: equationIndex should always be >= 0 since selectedAggregate
        // is an equation, but Math.max guards against an empty filter result.
        defaultSort = `-equation[${Math.max(0, equationIndex)}]`;
      } else {
        defaultSort = `-${selectedAggregate}`;
      }
    }
  }
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

  const limit = [DisplayType.BIG_NUMBER, DisplayType.TABLE].includes(
    state.displayType ?? DisplayType.TABLE
  )
    ? undefined
    : state.limit;

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
