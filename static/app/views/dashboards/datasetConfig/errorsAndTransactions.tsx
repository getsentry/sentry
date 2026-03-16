import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {doEventsRequest} from 'sentry/actionCreators/events';
import type {ResponseMeta} from 'sentry/api';
import {isMultiSeriesStats} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import type {EventData, MetaType} from 'sentry/utils/discover/eventView';
import type {
  FieldFormatterRenderFunctionPartial,
  RenderFunctionBaggage,
} from 'sentry/utils/discover/fieldRenderers';
import {emptyStringValue, getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {AggregationOutputType, QueryFieldValue} from 'sentry/utils/discover/fields';
import {
  errorsAndTransactionsAggregateFunctionOutputType,
  getAggregateAlias,
  isEquation,
  isLegalYAxisType,
  parseFunction,
  prettifyParsedFunction,
  SPAN_OP_BREAKDOWN_FIELDS,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {Container} from 'sentry/utils/discover/styles';
import {
  eventDetailsRouteWithEventView,
  generateEventSlug,
} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {FieldKey} from 'sentry/utils/fields';
import {getMeasurements} from 'sentry/utils/measurements/measurements';
import type {DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {handleOrderByReset} from 'sentry/views/dashboards/datasetConfig/base';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {transformEventsResponseToSeries} from 'sentry/views/dashboards/utils/transformEventsResponseToSeries';
import {EventsSearchBar} from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/eventsSearchBar';
import {CUSTOM_EQUATION_VALUE} from 'sentry/views/dashboards/widgetBuilder/components/sortBySelectors';
import {
  useErrorsAndTransactionsSeriesQuery,
  useErrorsAndTransactionsTableQuery,
} from 'sentry/views/dashboards/widgetCard/hooks/useErrorsAndTransactionsWidgetQuery';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import type {FieldValue} from 'sentry/views/discover/table/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';
import {
  createUnnamedTransactionsDiscoverTarget,
  DiscoverQueryPageSource,
  UNPARAMETERIZED_TRANSACTION,
} from 'sentry/views/performance/utils';

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: ['count()'],
  columns: [],
  fieldAliases: [],
  aggregates: ['count()'],
  conditions: '',
  orderby: '-count()',
};

const DEFAULT_FIELD: QueryFieldValue = {
  function: ['count', '', undefined, undefined],
  kind: FieldValueKind.FUNCTION,
};

export const ErrorsAndTransactionsConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats,
  TableData | EventsTableData
> = {
  defaultCategoryField: 'transaction',
  defaultField: DEFAULT_FIELD,
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: true,
  getCustomFieldRenderer: getCustomEventsFieldRenderer,
  SearchBar: EventsSearchBar,
  filterSeriesSortOptions,
  filterYAxisAggregateParams,
  filterYAxisOptions,
  getTableFieldOptions: getEventsTableFieldOptions,
  getTimeseriesSortOptions: (organization, widgetQuery, tags) =>
    getTimeseriesSortOptions(organization, widgetQuery, tags, getEventsTableFieldOptions),
  getTableSortOptions,
  getGroupByFieldOptions: getEventsTableFieldOptions,
  handleOrderByReset,
  supportedDisplayTypes: [
    DisplayType.AREA,
    DisplayType.BAR,
    DisplayType.BIG_NUMBER,
    DisplayType.CATEGORICAL_BAR,
    DisplayType.LINE,
    DisplayType.TABLE,
    DisplayType.TOP_N,
  ],
  useSeriesQuery: useErrorsAndTransactionsSeriesQuery,
  useTableQuery: useErrorsAndTransactionsTableQuery,
  transformSeries: transformEventsResponseToSeries,
  transformTable: transformEventsResponseToTable,
  filterAggregateParams,
  getSeriesResultType,
};

export function getTableSortOptions(
  _organization: Organization,
  widgetQuery: WidgetQuery
) {
  const {columns, aggregates} = widgetQuery;
  const options: Array<SelectValue<string>> = [];
  let equations = 0;
  [...aggregates, ...columns]
    .filter(field => !!field)
    .forEach(field => {
      let alias: any;
      let label = stripEquationPrefix(field);
      // Equations are referenced via a standard alias following this pattern
      if (isEquation(field)) {
        alias = `equation[${equations}]`;
        equations += 1;
      }

      const parsedFunction = parseFunction(field);
      if (parsedFunction) {
        label = prettifyParsedFunction(parsedFunction);
      }

      options.push({label, value: alias ?? field});
    });

  return options;
}

export function filterSeriesSortOptions(columns: Set<string>) {
  return (option: FieldValueOption) => {
    if (
      option.value.kind === FieldValueKind.FUNCTION ||
      option.value.kind === FieldValueKind.EQUATION
    ) {
      return true;
    }

    return (
      columns.has(option.value.meta.name) ||
      option.value.meta.name === CUSTOM_EQUATION_VALUE
    );
  };
}

export function getTimeseriesSortOptions(
  organization: Organization,
  widgetQuery: WidgetQuery,
  tags?: TagCollection,
  getFieldOptions: typeof getEventsTableFieldOptions = getEventsTableFieldOptions
) {
  const options: Record<string, SelectValue<FieldValue>> = {};
  options[`field:${CUSTOM_EQUATION_VALUE}`] = {
    label: 'Custom Equation',
    value: {
      kind: FieldValueKind.EQUATION,
      meta: {name: CUSTOM_EQUATION_VALUE},
    },
  };

  let equations = 0;
  [...widgetQuery.aggregates, ...widgetQuery.columns]
    .filter(field => !!field)
    .forEach(field => {
      let alias: any;
      const label = stripEquationPrefix(field);
      // Equations are referenced via a standard alias following this pattern
      if (isEquation(field)) {
        alias = `equation[${equations}]`;
        equations += 1;
        options[`equation:${alias}`] = {
          label,
          value: {
            kind: FieldValueKind.EQUATION,
            meta: {
              name: alias ?? field,
            },
          },
        };
      }
    });

  const fieldOptions = getFieldOptions(organization, tags);

  return {...options, ...fieldOptions};
}

function getEventsTableFieldOptions(
  organization: Organization,
  tags?: TagCollection,
  customMeasurements?: CustomMeasurementCollection
) {
  const measurements = getMeasurements();

  return generateFieldOptions({
    organization,
    tagKeys: Object.values(tags ?? {}).map(({key}) => key),
    measurementKeys: Object.values(measurements).map(({key}) => key),
    spanOperationBreakdownKeys: SPAN_OP_BREAKDOWN_FIELDS,
    customMeasurements: Object.values(customMeasurements ?? {}).map(
      ({key, functions}) => ({
        key,
        functions,
      })
    ),
  });
}

export function transformEventsResponseToTable(
  data: TableData | EventsTableData,
  _widgetQuery: WidgetQuery
): TableData {
  let tableData = data;
  // events api uses a different response format so we need to construct tableData differently
  const {fields, ...otherMeta} = (data as EventsTableData).meta ?? {};
  tableData = {
    ...data,
    meta: {...fields, ...otherMeta, fields},
  } as TableData;
  return tableData;
}

export function filterYAxisAggregateParams(
  fieldValue: QueryFieldValue,
  displayType: DisplayType
) {
  return (option: FieldValueOption) => {
    // Only validate function parameters for timeseries widgets and
    // world map widgets.
    if (displayType === DisplayType.BIG_NUMBER) {
      return true;
    }

    if (fieldValue.kind !== FieldValueKind.FUNCTION) {
      return true;
    }

    const functionName = fieldValue.function[0];
    const primaryOutput = errorsAndTransactionsAggregateFunctionOutputType(
      functionName as string,
      option.value.meta.name
    );
    if (primaryOutput) {
      return isLegalYAxisType(primaryOutput);
    }

    if (
      option.value.kind === FieldValueKind.FUNCTION ||
      option.value.kind === FieldValueKind.EQUATION
    ) {
      // Functions and equations are not legal options as an aggregate/function parameter.
      return false;
    }

    return isLegalYAxisType(option.value.meta.dataType);
  };
}

export function filterYAxisOptions(displayType: DisplayType) {
  return (option: FieldValueOption) => {
    // Only validate function names for timeseries widgets and
    // world map widgets.
    if (
      !(displayType === DisplayType.BIG_NUMBER) &&
      option.value.kind === FieldValueKind.FUNCTION
    ) {
      const primaryOutput = errorsAndTransactionsAggregateFunctionOutputType(
        option.value.meta.name,
        undefined
      );
      if (primaryOutput) {
        // If a function returns a specific type, then validate it.
        return isLegalYAxisType(primaryOutput);
      }
    }

    return option.value.kind === FieldValueKind.FUNCTION;
  };
}

// Get the series result type from the EventsStats meta
export function getSeriesResultType(
  data: EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats,
  widgetQuery: WidgetQuery
): Record<string, AggregationOutputType> {
  const field = widgetQuery.aggregates[0]!;
  const resultTypes = {};
  // Need to use getAggregateAlias since events-stats still uses aggregate alias format
  if (isMultiSeriesStats(data)) {
    Object.keys(data).forEach(
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      key => (resultTypes[key] = data[key]!.meta?.fields[getAggregateAlias(key)])
    );
  } else {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    resultTypes[field] = data.meta?.fields[getAggregateAlias(field)];
  }
  return resultTypes;
}

export function renderEventIdAsLinkable(
  data: EventData,
  {eventView, organization}: RenderFunctionBaggage
) {
  const id: string | unknown = data?.id;
  if (!eventView || typeof id !== 'string') {
    return <Container>{emptyStringValue}</Container>;
  }

  const eventSlug = generateEventSlug(data);

  const target = eventDetailsRouteWithEventView({
    organization,
    eventSlug,
    eventView,
  });

  return (
    <Link data-test-id="view-event" to={target}>
      <StyledTooltip title={t('View Event')}>
        <Container>{getShortEventId(id)}</Container>
      </StyledTooltip>
    </Link>
  );
}

export function renderTraceAsLinkable(widget?: Widget) {
  return function (
    data: EventData,
    {eventView, organization, location}: RenderFunctionBaggage
  ) {
    const id: string | unknown = data?.trace;
    if (!eventView || typeof id !== 'string') {
      return <Container>{emptyStringValue}</Container>;
    }
    const dateSelection = eventView.normalizeDateSelection(location);
    const target = getTraceDetailsUrl({
      organization,
      traceSlug: String(data.trace),
      dateSelection,
      timestamp: getTimeStampFromTableDateField(data['max(timestamp)'] ?? data.timestamp),
      location: widget
        ? {
            ...location,
            query: {
              ...location.query,
              widgetId: widget.id,
              dashboardId: widget.dashboardId,
            },
          }
        : location,
      source: TraceViewSources.DASHBOARDS,
    });

    return (
      <Link data-test-id="view-trace" to={target}>
        <StyledTooltip title={t('View Trace')}>
          <Container>{getShortEventId(id)}</Container>
        </StyledTooltip>
      </Link>
    );
  };
}

export function getCustomEventsFieldRenderer(
  field: string,
  meta: MetaType,
  widget?: Widget
): FieldFormatterRenderFunctionPartial {
  if (field === 'id') {
    return renderEventIdAsLinkable;
  }

  if (field === 'trace') {
    return renderTraceAsLinkable(widget);
  }

  // When title or transaction are << unparameterized >>, link out to discover showing unparameterized transactions
  if (['title', 'transaction'].includes(field)) {
    return function (data, baggage) {
      if (data[field] === UNPARAMETERIZED_TRANSACTION) {
        return (
          <Container>
            <Link
              to={createUnnamedTransactionsDiscoverTarget({
                location: baggage.location,
                organization: baggage.organization,
                source: DiscoverQueryPageSource.DISCOVER,
              })}
            >
              {data[field]}
            </Link>
          </Container>
        );
      }
      return getFieldRenderer(field, meta, false)(data, baggage);
    };
  }
  return getFieldRenderer(field, meta, false);
}

export async function doOnDemandMetricsRequest(
  api: any,
  requestData: any,
  widgetType: any
): Promise<
  [EventsStats | MultiSeriesEventsStats, string | undefined, ResponseMeta | undefined]
> {
  try {
    const isEditing = location.pathname.endsWith('/edit/');

    const fetchEstimatedStats = () =>
      `/organizations/${requestData.organization.slug}/metrics-estimation-stats/`;

    const response = await doEventsRequest<true>(api, {
      ...requestData,
      includeAllArgs: true,
      queryExtras: {
        ...requestData.queryExtras,
        useOnDemandMetrics: true,
        onDemandType: 'dynamic_query',
      },
      dataset: 'metricsEnhanced',
      generatePathname: isEditing ? fetchEstimatedStats : undefined,
    });

    response[0] = {...response[0]};

    if (
      hasDatasetSelector(requestData.organization) &&
      widgetType === WidgetType.DISCOVER
    ) {
      const meta: any = response[0].meta ?? {};
      meta.discoverSplitDecision = 'transaction-like';
      response[0] = {...response[0], ...{meta}};
    }

    return [response[0], response[1], response[2]];
  } catch (err: any) {
    Sentry.captureMessage('Failed to fetch metrics estimation stats', {extra: err});
    return doEventsRequest<true>(api, requestData);
  }
}

// Checks fieldValue to see what function is being used and only allow supported custom measurements
export function filterAggregateParams(
  option: FieldValueOption,
  fieldValue?: QueryFieldValue
) {
  if (
    (option.value.kind === FieldValueKind.CUSTOM_MEASUREMENT &&
      fieldValue?.kind === 'function' &&
      fieldValue?.function &&
      !option.value.meta.functions.includes(fieldValue.function[0])) ||
    option.value.meta.name === FieldKey.TOTAL_COUNT
  ) {
    return false;
  }
  return true;
}

const StyledTooltip = styled(Tooltip)`
  vertical-align: middle;
`;
