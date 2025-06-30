import trimStart from 'lodash/trimStart';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import toArray from 'sentry/utils/array/toArray';
import {
  getAggregateAlias,
  isAggregateFieldOrEquation,
} from 'sentry/utils/discover/fields';
import {
  decodeBoolean,
  decodeList,
  decodeScalar,
  decodeSorts,
} from 'sentry/utils/queryString';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {
  applyDashboardFilters,
  eventViewFromWidget,
  getFieldsFromEquations,
  getWidgetInterval,
} from 'sentry/views/dashboards/utils';
import {
  LOGS_AGGREGATE_FN_KEY,
  LOGS_AGGREGATE_PARAM_KEY,
  LOGS_FIELDS_KEY,
  LOGS_GROUP_BY_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreMultiQueryUrl, getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';

export function getWidgetLogURL(
  widget: Widget,
  dashboardFilters: DashboardFilters | undefined,
  selection: PageFilters,
  organization: Organization
) {
  const params = new URLSearchParams();
  if (widget.queries?.[0]) {
    const query = widget.queries[0];
    if (query.aggregates[0]) {
      const aggregate = query.aggregates[0];
      const [_, fn, arg] = aggregate.match(/^(\w+)\(([^)]+)\)$/) || [];
      if (arg) {
        params.set(LOGS_AGGREGATE_PARAM_KEY, arg);
      }
      if (fn) {
        params.set(LOGS_AGGREGATE_FN_KEY, fn);
      }
    }
    const conditions = applyDashboardFilters(query.conditions, dashboardFilters);
    if (conditions) {
      params.set(LOGS_QUERY_KEY, conditions);
    }
    for (const field of query.columns ?? []) {
      params.append(LOGS_FIELDS_KEY, field);
    }
    for (const groupBy of query?.fields?.filter(
      field => !isAggregateFieldOrEquation(field)
    ) || []) {
      params.append(LOGS_GROUP_BY_KEY, groupBy);
    }
  }

  const eventView = eventViewFromWidget(widget.title, widget.queries[0]!, selection);
  const locationQueryParams = eventView.generateQueryStringObject();
  const effectiveSelection = {
    ...selection,
    end: decodeScalar(locationQueryParams.end) ?? null,
    period: decodeScalar(locationQueryParams.statsPeriod) ?? null,
    start: decodeScalar(locationQueryParams.start) ?? null,
    utc: decodeBoolean(locationQueryParams.utc) ?? null,
  };
  if (effectiveSelection.start) {
    params.set('start', effectiveSelection.start);
  }
  if (effectiveSelection.end) {
    params.set('end', effectiveSelection.end);
  }
  if (effectiveSelection.period) {
    params.set('statsPeriod', effectiveSelection.period);
  }
  if (effectiveSelection.utc) {
    params.set('utc', 'true');
  }
  for (const project of effectiveSelection.projects) {
    params.append('projects', String(project));
  }
  for (const environment of effectiveSelection.environments) {
    params.append('environments', environment);
  }

  return normalizeUrl(
    `/organizations/${organization.slug}/explore/logs?${params.toString()}`
  );
}

export function getWidgetExploreUrl(
  widget: Widget,
  dashboardFilters: DashboardFilters | undefined,
  selection: PageFilters,
  organization: Organization
) {
  if (widget.queries.length > 1) {
    return _getWidgetExploreUrlForMultipleQueries(
      widget,
      dashboardFilters,
      selection,
      organization
    );
  }

  return _getWidgetExploreUrl(widget, dashboardFilters, selection, organization);
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

function _getWidgetExploreUrl(
  widget: Widget,
  dashboardFilters: DashboardFilters | undefined,
  selection: PageFilters,
  organization: Organization
) {
  const eventView = eventViewFromWidget(widget.title, widget.queries[0]!, selection);
  const locationQueryParams = eventView.generateQueryStringObject();

  // Inject the sort field for cases of arbitrary sorting
  // The sort is not picked up by eventView unless it is
  // injected into the fields
  locationQueryParams.sort = widget.queries[0]!.orderby;

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
  let exploreMode: Mode | undefined = undefined;
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

  // Equation fields need to have their terms explicitly selected as columns in the discover table
  const fields =
    Array.isArray(locationQueryParams.field) || !defined(locationQueryParams.field)
      ? locationQueryParams.field
      : [locationQueryParams.field];

  const query = widget.queries[0]!;
  const queryFields =
    defined(query.fields) && widget.displayType === DisplayType.TABLE
      ? query.fields.filter(field => !isAggregateFieldOrEquation(field))
      : [...query.columns];

  // Updates fields by adding any individual terms from equation fields as a column
  getFieldsFromEquations(queryFields).forEach(term => {
    if (Array.isArray(fields) && !fields.includes(term)) {
      fields.unshift(term);
    }
  });
  locationQueryParams.field = fields;

  const datetime = {
    end: decodeScalar(locationQueryParams.end) ?? null,
    period: decodeScalar(locationQueryParams.statsPeriod) ?? null,
    start: decodeScalar(locationQueryParams.start) ?? null,
    utc: decodeBoolean(locationQueryParams.utc) ?? null,
  };

  let groupBy = queryFields?.filter(field => !isAggregateFieldOrEquation(field));
  if (groupBy && groupBy.length === 0) {
    // Force the groupBy to be an array with a single empty string
    // so that qs.stringify appends the key to the URL. If the key
    // is not present, the Explore UI will assign a default groupBy
    // which we do not want if the user has not specified a groupBy.
    groupBy = [''];
  }

  const queryParams = {
    // Page filters should propagate
    selection: {
      ...selection,
      datetime,
    },
    organization,
    mode: exploreMode,
    visualize: [
      {
        chartType,
        yAxes: locationQueryParams.yAxes,
      },
      // Explore widgets do not allow sorting by arbitrary aggregates
      // so dashboard widgets need to inject another visualize to plot the sort
      // and it available for sorting the main chart
      ...(locationQueryParams.sort &&
      !_isSortIncluded(locationQueryParams.sort, locationQueryParams.yAxes)
        ? [
            {
              chartType,
              yAxes: toArray(trimStart(locationQueryParams.sort, '-')),
            },
          ]
        : []),
    ],
    groupBy: exploreMode === Mode.SAMPLES ? undefined : groupBy,
    field: exploreMode === Mode.SAMPLES ? decodeList(queryFields) : undefined,
    query: applyDashboardFilters(
      decodeScalar(locationQueryParams.query),
      dashboardFilters
    ),
    sort: locationQueryParams.sort || undefined,
    interval:
      decodeScalar(locationQueryParams.interval) ??
      getWidgetInterval(widget, selection.datetime),
  };

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
  organization: Organization
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
  });
}
