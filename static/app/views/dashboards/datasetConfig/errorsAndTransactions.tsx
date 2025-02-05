import * as Sentry from '@sentry/react';
import trimStart from 'lodash/trimStart';

import {doEventsRequest} from 'sentry/actionCreators/events';
import type {Client, ResponseMeta} from 'sentry/api';
import {isMultiSeriesStats} from 'sentry/components/charts/utils';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {PageFilters, SelectValue} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import type {MetaType} from 'sentry/utils/discover/eventView';
import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {AggregationOutputType, QueryFieldValue} from 'sentry/utils/discover/fields';
import {
  errorsAndTransactionsAggregateFunctionOutputType,
  getAggregateAlias,
  isEquation,
  isEquationAlias,
  isLegalYAxisType,
  SPAN_OP_BREAKDOWN_FIELDS,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import type {
  DiscoverQueryExtras,
  DiscoverQueryRequestParams,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {Container} from 'sentry/utils/discover/styles';
import {TOP_N} from 'sentry/utils/discover/types';
import {
  eventDetailsRouteWithEventView,
  generateEventSlug,
} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {FieldKey} from 'sentry/utils/fields';
import {getMeasurements} from 'sentry/utils/measurements/measurements';
import {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import {shouldUseOnDemandMetrics} from 'sentry/utils/performance/contexts/onDemandControl';
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

import type {Widget, WidgetQuery} from '../types';
import {DisplayType, WidgetType} from '../types';
import {
  eventViewFromWidget,
  getDashboardsMEPQueryParams,
  getNumEquations,
  getWidgetInterval,
  hasDatasetSelector,
} from '../utils';
import {transformEventsResponseToSeries} from '../utils/transformEventsResponseToSeries';
import {EventsSearchBar} from '../widgetBuilder/buildSteps/filterResultsStep/eventsSearchBar';
import {CUSTOM_EQUATION_VALUE} from '../widgetBuilder/buildSteps/sortByStep';

import type {DatasetConfig} from './base';
import {handleOrderByReset} from './base';

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
    DisplayType.LINE,
    DisplayType.TABLE,
    DisplayType.TOP_N,
  ],
  getTableRequest: (
    api: Client,
    widget: Widget,
    query: WidgetQuery,
    organization: Organization,
    pageFilters: PageFilters,
    onDemandControlContext?: OnDemandControlContext,
    limit?: number,
    cursor?: string,
    referrer?: string,
    mepSetting?: MEPState | null
  ) => {
    const url = `/organizations/${organization.slug}/events/`;

    const useOnDemandMetrics = shouldUseOnDemandMetrics(
      organization,
      widget,
      onDemandControlContext
    );
    const queryExtras = {
      useOnDemandMetrics,
      ...getQueryExtraForSplittingDiscover(widget, organization, !!useOnDemandMetrics),
      onDemandType: 'dynamic_query',
    };
    return getEventsRequest(
      url,
      api,
      query,
      organization,
      pageFilters,
      limit,
      cursor,
      referrer,
      mepSetting,
      queryExtras
    );
  },
  getSeriesRequest: getEventsSeriesRequest,
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
      const label = stripEquationPrefix(field);
      // Equations are referenced via a standard alias following this pattern
      if (isEquation(field)) {
        alias = `equation[${equations}]`;
        equations += 1;
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
function getSeriesResultType(
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
  data: any,
  {eventView, organization}: RenderFunctionBaggage
) {
  const id: string | unknown = data?.id;
  if (!eventView || typeof id !== 'string') {
    return null;
  }

  const eventSlug = generateEventSlug(data);

  const target = eventDetailsRouteWithEventView({
    orgSlug: organization.slug,
    eventSlug,
    eventView,
  });

  return (
    <Tooltip title={t('View Event')}>
      <Link data-test-id="view-event" to={target}>
        <Container>{getShortEventId(id)}</Container>
      </Link>
    </Tooltip>
  );
}

export function renderTraceAsLinkable(widget?: Widget) {
  return function (
    data: any,
    {eventView, organization, location}: RenderFunctionBaggage
  ) {
    const id: string | unknown = data?.trace;
    if (!eventView || typeof id !== 'string') {
      return null;
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
      <Tooltip title={t('View Trace')}>
        <Link data-test-id="view-trace" to={target}>
          <Container>{getShortEventId(id)}</Container>
        </Link>
      </Tooltip>
    );
  };
}

export function getCustomEventsFieldRenderer(
  field: string,
  meta: MetaType,
  widget?: Widget
) {
  if (field === 'id') {
    return renderEventIdAsLinkable;
  }

  if (field === 'trace') {
    return renderTraceAsLinkable(widget);
  }

  // When title or transaction are << unparameterized >>, link out to discover showing unparameterized transactions
  if (['title', 'transaction'].includes(field)) {
    return function (data: any, baggage: any) {
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

export function getEventsRequest(
  url: string,
  api: Client,
  query: WidgetQuery,
  _organization: Organization,
  pageFilters: PageFilters,
  limit?: number,
  cursor?: string,
  referrer?: string,
  mepSetting?: MEPState | null,
  queryExtras?: DiscoverQueryExtras
) {
  const isMEPEnabled = defined(mepSetting) && mepSetting !== MEPState.TRANSACTIONS_ONLY;

  const eventView = eventViewFromWidget('', query, pageFilters);

  const params: DiscoverQueryRequestParams = {
    per_page: limit,
    cursor,
    referrer,
    ...getDashboardsMEPQueryParams(isMEPEnabled),
    ...queryExtras,
  };

  if (query.orderby) {
    params.sort = typeof query.orderby === 'string' ? [query.orderby] : query.orderby;
  }

  // TODO: eventually need to replace this with just EventsTableData as we deprecate eventsv2
  return doDiscoverQuery<TableData | EventsTableData>(
    api,
    url,
    {
      ...eventView.generateQueryStringObject(),
      ...params,
    },
    // Tries events request up to 3 times on rate limit
    {
      retry: {
        statusCodes: [429],
        tries: 3,
      },
    }
  );
}

function getEventsSeriesRequest(
  api: Client,
  widget: Widget,
  queryIndex: number,
  organization: Organization,
  pageFilters: PageFilters,
  onDemandControlContext?: OnDemandControlContext,
  referrer?: string,
  mepSetting?: MEPState | null
) {
  const widgetQuery = widget.queries[queryIndex]!;
  const {displayType, limit} = widget;
  const {environments, projects} = pageFilters;
  const {start, end, period: statsPeriod} = pageFilters.datetime;
  const interval = getWidgetInterval(
    displayType,
    {start, end, period: statsPeriod},
    '1m'
  );
  const isMEPEnabled = defined(mepSetting) && mepSetting !== MEPState.TRANSACTIONS_ONLY;

  let requestData: any;
  if (displayType === DisplayType.TOP_N) {
    requestData = {
      organization,
      interval,
      start,
      end,
      project: projects,
      environment: environments,
      period: statsPeriod,
      query: widgetQuery.conditions,
      yAxis: widgetQuery.aggregates[widgetQuery.aggregates.length - 1],
      includePrevious: false,
      referrer,
      partial: true,
      field: [...widgetQuery.columns, ...widgetQuery.aggregates],
      queryExtras: getDashboardsMEPQueryParams(isMEPEnabled),
      includeAllArgs: true,
      topEvents: TOP_N,
    };
    if (widgetQuery.orderby) {
      requestData.orderby = widgetQuery.orderby;
    }
  } else {
    requestData = {
      organization,
      interval,
      start,
      end,
      project: projects,
      environment: environments,
      period: statsPeriod,
      query: widgetQuery.conditions,
      yAxis: widgetQuery.aggregates,
      orderby: widgetQuery.orderby,
      includePrevious: false,
      referrer,
      partial: true,
      queryExtras: getDashboardsMEPQueryParams(isMEPEnabled),
      includeAllArgs: true,
    };
    if (widgetQuery.columns?.length !== 0) {
      requestData.topEvents = limit ?? TOP_N;
      requestData.field = [...widgetQuery.columns, ...widgetQuery.aggregates];

      // Compare field and orderby as aliases to ensure requestData has
      // the orderby selected
      // If the orderby is an equation alias, do not inject it
      const orderby = trimStart(widgetQuery.orderby, '-');
      if (
        widgetQuery.orderby &&
        !isEquationAlias(orderby) &&
        !requestData.field.includes(orderby)
      ) {
        requestData.field.push(orderby);
      }

      // The "Other" series is only included when there is one
      // y-axis and one widgetQuery
      requestData.excludeOther =
        widgetQuery.aggregates.length !== 1 || widget.queries.length !== 1;

      if (isEquation(trimStart(widgetQuery.orderby, '-'))) {
        const nextEquationIndex = getNumEquations(widgetQuery.aggregates);
        const isDescending = widgetQuery.orderby.startsWith('-');
        const prefix = isDescending ? '-' : '';

        // Construct the alias form of the equation and inject it into the request
        requestData.orderby = `${prefix}equation[${nextEquationIndex}]`;
        requestData.field = [
          ...widgetQuery.columns,
          ...widgetQuery.aggregates,
          trimStart(widgetQuery.orderby, '-'),
        ];
      }
    }
  }

  if (shouldUseOnDemandMetrics(organization, widget, onDemandControlContext)) {
    requestData.queryExtras = {
      ...requestData.queryExtras,
      ...getQueryExtraForSplittingDiscover(widget, organization, true),
    };
    return doOnDemandMetricsRequest(api, requestData, widget.widgetType);
  }

  if (organization.features.includes('performance-discover-dataset-selector')) {
    requestData.queryExtras = {
      ...requestData.queryExtras,
      ...getQueryExtraForSplittingDiscover(widget, organization, false),
    };
  }

  return doEventsRequest<true>(api, requestData);
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

    const response = await doEventsRequest<false>(api, {
      ...requestData,
      queryExtras: {
        ...requestData.queryExtras,
        useOnDemandMetrics: true,
        onDemandType: 'dynamic_query',
      },
      dataset: 'metricsEnhanced',
      generatePathname: isEditing ? fetchEstimatedStats : undefined,
    });

    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    response[0] = {...response[0]};

    if (
      hasDatasetSelector(requestData.organization) &&
      widgetType === WidgetType.DISCOVER
    ) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const meta = response[0].meta ?? {};
      meta.discoverSplitDecision = 'transaction-like';
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      response[0] = {...response[0], ...{meta}};
    }

    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return [response[0], response[1], response[2]];
  } catch (err) {
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

const getQueryExtraForSplittingDiscover = (
  widget: Widget,
  organization: Organization,
  useOnDemandMetrics: boolean
) => {
  // We want to send the dashboardWidgetId on the request if we're in the Widget
  // Builder with the selector feature flag
  const isEditing = location.pathname.endsWith('/edit/');
  const hasDiscoverSelector = organization.features.includes(
    'performance-discover-dataset-selector'
  );

  if (!hasDiscoverSelector) {
    if (
      !useOnDemandMetrics ||
      !organization.features.includes('performance-discover-widget-split-ui')
    ) {
      return {};
    }
    if (widget.id) {
      return {dashboardWidgetId: widget.id};
    }

    return {};
  }

  if (isEditing && widget.id) {
    return {dashboardWidgetId: widget.id};
  }

  return {};
};
