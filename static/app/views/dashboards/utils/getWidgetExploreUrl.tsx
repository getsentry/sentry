import * as Sentry from '@sentry/react';
import trimStart from 'lodash/trimStart';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {
  getAggregateAlias,
  getEquationAliasIndex,
  isAggregateField,
  isAggregateFieldOrEquation,
  isEquation,
  isEquationAlias,
  parseFunction,
} from 'sentry/utils/discover/fields';
import {FieldKind, getFieldDefinition} from 'sentry/utils/fields';
import {decodeBoolean, decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {
  applyDashboardFilters,
  eventViewFromWidget,
  getWidgetInterval,
} from 'sentry/views/dashboards/utils';
import {getReferrer} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import type {TabularRow} from 'sentry/views/dashboards/widgets/common/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getLogsUrl} from 'sentry/views/explore/logs/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getExploreMultiQueryUrl, getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';

function getTraceItemDatasetFromWidgetType(widgetType?: WidgetType): TraceItemDataset {
  switch (widgetType) {
    case WidgetType.LOGS:
      return TraceItemDataset.LOGS;
    case WidgetType.SPANS:
      return TraceItemDataset.SPANS;
    case WidgetType.PREPROD_APP_SIZE:
      return TraceItemDataset.PREPROD;
    default:
      return TraceItemDataset.SPANS; // Default to spans for backwards compatibility
  }
}

function getWidgetExploreUrlWithDataset(traceItemDataset: TraceItemDataset) {
  return (
    widget: Widget,
    dashboardFilters: DashboardFilters | undefined,
    selection: PageFilters,
    organization: Organization,
    preferMode?: Mode,
    referrer?: string
  ) => {
    return _getWidgetExploreUrl(
      widget,
      dashboardFilters,
      selection,
      organization,
      preferMode,
      undefined,
      traceItemDataset,
      referrer
    );
  };
}

const WIDGET_TRACE_ITEM_TO_URL_FUNCTION: Record<
  TraceItemDataset,
  | ((
      widget: Widget,
      dashboardFilters: DashboardFilters | undefined,
      selection: PageFilters,
      organization: Organization,
      preferMode?: Mode,
      referrer?: string
    ) => string)
  | undefined
> = {
  [TraceItemDataset.LOGS]: getWidgetExploreUrlWithDataset(TraceItemDataset.LOGS),
  [TraceItemDataset.SPANS]: getWidgetExploreUrlWithDataset(TraceItemDataset.SPANS),
  [TraceItemDataset.UPTIME_RESULTS]: undefined,
  [TraceItemDataset.TRACEMETRICS]: getWidgetExploreUrlWithDataset(
    TraceItemDataset.TRACEMETRICS
  ),
  [TraceItemDataset.PREPROD]: undefined,
};

export function getWidgetExploreUrl(
  widget: Widget,
  dashboardFilters: DashboardFilters | undefined,
  selection: PageFilters,
  organization: Organization,
  preferMode?: Mode,
  referrer?: string
) {
  const traceItemDataset = getTraceItemDatasetFromWidgetType(widget.widgetType);

  if (widget.queries.length > 1) {
    if (traceItemDataset === TraceItemDataset.LOGS) {
      Sentry.captureException(
        new Error(
          `getWidgetExploreUrl: multiple queries for logs is unsupported, widget_id: ${widget.id}, organization_id: ${organization.id}, dashboard_id: ${widget.dashboardId}`
        )
      );
    }
    return _getWidgetExploreUrlForMultipleQueries(
      widget,
      dashboardFilters,
      selection,
      organization,
      traceItemDataset,
      referrer
    );
  }

  const urlFunction = WIDGET_TRACE_ITEM_TO_URL_FUNCTION[traceItemDataset];

  if (urlFunction) {
    return urlFunction(
      widget,
      dashboardFilters,
      selection,
      organization,
      preferMode,
      referrer
    );
  }

  return _getWidgetExploreUrl(
    widget,
    dashboardFilters,
    selection,
    organization,
    preferMode,
    undefined,
    traceItemDataset,
    referrer
  );
}

function getChartType(displayType: DisplayType) {
  let chartType: ChartType = ChartType.LINE;
  switch (displayType) {
    case DisplayType.BAR:
      chartType = ChartType.BAR;
      break;
    case DisplayType.LINE:
      chartType = ChartType.LINE;
      break;
    case DisplayType.AREA:
      chartType = ChartType.AREA;
      break;
    case DisplayType.TABLE:
    case DisplayType.BIG_NUMBER:
      break;
    default:
      break;
  }

  return chartType;
}

function getAggregateArguments(yAxis: string): string[] {
  const parsedFunction = parseFunction(yAxis);
  if (!parsedFunction) {
    return [];
  }
  const definition = getFieldDefinition(parsedFunction.name, 'span');
  if (definition?.kind !== FieldKind.FUNCTION) {
    return [];
  }
  return parsedFunction.arguments.filter((_argument, index) => {
    return definition.parameters?.[index]?.kind === 'column';
  });
}

function _getWidgetExploreUrl(
  widget: Widget,
  dashboardFilters: DashboardFilters | undefined,
  selection: PageFilters,
  organization: Organization,
  preferMode?: Mode,
  overrideQuery?: MutableSearch,
  traceItemDataset?: TraceItemDataset,
  referrer?: string
) {
  const eventView = eventViewFromWidget(widget.title, widget.queries[0]!, selection);
  const locationQueryParams = eventView.generateQueryStringObject();

  // Pull a max of 3 valid Y-Axis from the widget
  const yAxisOptions = eventView.getYAxisOptions().map(({value}) => value);
  locationQueryParams.yAxes = [
    ...new Set(
      (widget.displayType === DisplayType.TABLE
        ? widget.queries[0]!.fields?.filter(isAggregateFieldOrEquation)
        : widget.queries[0]!.aggregates
      )?.filter(aggregate => yAxisOptions.includes(aggregate))
    ),
  ].slice(0, 3);

  const chartType = getChartType(widget.displayType);
  let exploreMode: Mode | undefined = preferMode;
  if (!defined(exploreMode)) {
    switch (widget.displayType) {
      case DisplayType.BAR:
        exploreMode = Mode.AGGREGATE;
        break;
      case DisplayType.LINE:
        exploreMode = Mode.AGGREGATE;
        break;
      case DisplayType.AREA:
        exploreMode = Mode.AGGREGATE;
        break;
      case DisplayType.TABLE:
      case DisplayType.BIG_NUMBER:
        if (locationQueryParams.yAxes.length > 0) {
          exploreMode = Mode.AGGREGATE;
        } else {
          exploreMode = Mode.SAMPLES;
        }
        break;
      default:
        break;
    }
  }

  const datetime = {
    end: decodeScalar(locationQueryParams.end) ?? null,
    period: decodeScalar(locationQueryParams.statsPeriod) ?? null,
    start: decodeScalar(locationQueryParams.start) ?? null,
    utc: decodeBoolean(locationQueryParams.utc) ?? null,
  };

  const query = widget.queries[0]!;

  let groupBy: string[] =
    defined(query.fields) && widget.displayType === DisplayType.TABLE
      ? query.fields.filter(
          field => !isAggregateFieldOrEquation(field) && field !== 'timestamp'
        )
      : [...query.columns];
  if (groupBy && groupBy.length === 0) {
    // Force the groupBy to be an array with a single empty string
    // so that qs.stringify appends the key to the URL. If the key
    // is not present, the Explore UI will assign a default groupBy
    // which we do not want if the user has not specified a groupBy.
    groupBy = [''];
  }

  const yAxisFields: string[] = locationQueryParams.yAxes.flatMap(getAggregateArguments);
  const fields = [...new Set([...groupBy, ...yAxisFields])].filter(Boolean);

  const sortDirection = widget.queries[0]?.orderby?.startsWith('-') ? '-' : '';
  const sortColumn = trimStart(widget.queries[0]?.orderby ?? '', '-');

  let sort: string | undefined = undefined;
  if (isAggregateField(sortColumn)) {
    if (exploreMode === Mode.SAMPLES) {
      // if the current sort is on an aggregation, then we should extract its argument
      // and try to sort on that in samples mode
      const aggregateArguments = getAggregateArguments(sortColumn);
      if (aggregateArguments.length > 0) {
        sort = `${sortDirection}${aggregateArguments[0]}`;
      }
    } else if (exploreMode === Mode.AGGREGATE) {
      sort = widget.queries[0]?.orderby;
    }
  } else if (isEquationAlias(sortColumn) && exploreMode === Mode.AGGREGATE) {
    const equations = query.fields?.filter(isEquation) ?? [];
    const equationIndex = getEquationAliasIndex(sortColumn);

    const orderby = equations[equationIndex];
    if (orderby) {
      sort = `${sortDirection}${orderby}`;
    }
  } else if (!isAggregateFieldOrEquation(sortColumn)) {
    sort = widget.queries[0]?.orderby;
  }

  const visualize = [
    {
      chartType,
      yAxes: locationQueryParams.yAxes,
    },
    // Explore widgets do not allow sorting by arbitrary aggregates
    // so dashboard widgets need to inject another visualize to plot the sort
    // and it available for sorting the main chart
    ...(isAggregateField(sortColumn) &&
    !_isSortIncluded(sortColumn, locationQueryParams.yAxes)
      ? [{chartType, yAxes: [sortColumn]}]
      : []),
  ].filter(v => v.yAxes.length > 0);

  const queryParams = {
    // Page filters should propagate
    selection: {
      ...selection,
      datetime,
    },
    organization,
    mode: exploreMode,
    visualize,
    groupBy: visualize.length > 0 ? groupBy : [],
    field: fields,
    query: applyDashboardFilters(
      overrideQuery?.formatString() ?? decodeScalar(locationQueryParams.query),
      dashboardFilters,
      widget.widgetType
    ),
    sort: sort || undefined,
    interval:
      decodeScalar(locationQueryParams.interval) ??
      getWidgetInterval(widget, selection.datetime),
    referrer,
  };

  if (traceItemDataset === TraceItemDataset.LOGS) {
    return getLogsUrl({
      organization: queryParams.organization,
      selection: queryParams.selection,
      query: queryParams.query,
      field: queryParams.field,
      groupBy: queryParams.groupBy,
      aggregateFields: queryParams.visualize,
      interval: queryParams.interval,
      mode: queryParams.mode,
      referrer: queryParams.referrer,
    });
  }

  return getExploreUrl(queryParams);
}

function _isSortIncluded(sort: string, yAxes: string[]) {
  const rawSort = trimStart(sort, '-');
  return yAxes.map(getAggregateAlias).includes(getAggregateAlias(rawSort));
}

function _getWidgetExploreUrlForMultipleQueries(
  widget: Widget,
  dashboardFilters: DashboardFilters | undefined,
  selection: PageFilters,
  organization: Organization,
  _traceItemDataset: TraceItemDataset,
  referrer?: string
): string {
  const eventView = eventViewFromWidget(widget.title, widget.queries[0]!, selection);
  const locationQueryParams = eventView.generateQueryStringObject();
  const datetime = {
    end: decodeScalar(locationQueryParams.end) ?? null,
    period: decodeScalar(locationQueryParams.statsPeriod) ?? null,
    start: decodeScalar(locationQueryParams.start) ?? null,
    utc: decodeBoolean(locationQueryParams.utc) ?? null,
  };

  const currentSelection = {
    ...selection,
    datetime,
  };

  return getExploreMultiQueryUrl({
    organization,
    title: widget.title,
    selection: currentSelection,
    queries: widget.queries.map(query => ({
      chartType: getChartType(widget.displayType),
      query: applyDashboardFilters(query.conditions, dashboardFilters) ?? '',
      sortBys: decodeSorts(query.orderby),
      yAxes: query.aggregates,
      fields: [],
      groupBys: query.columns,
    })),
    interval: getWidgetInterval(widget, currentSelection.datetime),
    referrer,
  });
}

export function getWidgetTableRowExploreUrlFunction(
  selection: PageFilters,
  widget: Widget,
  organization: Organization,
  dashboardFilters?: DashboardFilters,
  selectedQueryIndex = 0
) {
  return (dataRow: TabularRow) => {
    let fields: string[] = [];
    if (widget.queries[selectedQueryIndex]?.fields) {
      fields = widget.queries[selectedQueryIndex].fields.filter(
        (field: string) => !isAggregateFieldOrEquation(field)
      );
    }

    const query = new MutableSearch(widget.queries[selectedQueryIndex]?.conditions ?? '');
    fields.map(field => {
      const value = dataRow[field];
      if (!defined(value)) {
        return query.addFilterValue('!has', field);
      }
      if (Array.isArray(value)) {
        return query.addFilterValues(field, value);
      }
      return query.addFilterValue(field, String(value));
    });

    return _getWidgetExploreUrl(
      widget,
      dashboardFilters,
      selection,
      organization,
      Mode.SAMPLES,
      query,
      undefined,
      `${getReferrer(widget.displayType)}.row`
    );
  };
}
