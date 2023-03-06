import {browserHistory} from 'react-router';
import {Location, Query} from 'history';
import cloneDeep from 'lodash/cloneDeep';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import trimStart from 'lodash/trimStart';
import * as qs from 'query-string';

import WidgetArea from 'sentry-images/dashboard/widget-area.svg';
import WidgetBar from 'sentry-images/dashboard/widget-bar.svg';
import WidgetBigNumber from 'sentry-images/dashboard/widget-big-number.svg';
import WidgetLine from 'sentry-images/dashboard/widget-line-1.svg';
import WidgetTable from 'sentry-images/dashboard/widget-table.svg';
import WidgetWorldMap from 'sentry-images/dashboard/widget-world-map.svg';

import {parseArithmetic} from 'sentry/components/arithmeticInput/parser';
import {
  Fidelity,
  getDiffInMinutes,
  getInterval,
  SIX_HOURS,
  TWENTY_FOUR_HOURS,
} from 'sentry/components/charts/utils';
import {normalizeDateTimeString} from 'sentry/components/organizations/pageFilters/parse';
import {parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {Organization, PageFilters} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getUtcDateString, parsePeriodToHours} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import {
  getAggregateAlias,
  getAggregateArg,
  getColumnsAndAggregates,
  isEquation,
  isMeasurement,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {DisplayModes} from 'sentry/utils/discover/types';
import {getMeasurements} from 'sentry/utils/measurements/measurements';
import {decodeList} from 'sentry/utils/queryString';
import {
  DashboardDetails,
  DashboardFilterKeys,
  DashboardFilters,
  DisplayType,
  Widget,
  WidgetQuery,
  WidgetType,
} from 'sentry/views/dashboards/types';

export type ValidationError = {
  [key: string]: string | string[] | ValidationError[] | ValidationError;
};

export type FlatValidationError = {
  [key: string]: string | FlatValidationError[] | FlatValidationError;
};

export function cloneDashboard(dashboard: DashboardDetails): DashboardDetails {
  return cloneDeep(dashboard);
}

export function eventViewFromWidget(
  title: string,
  query: WidgetQuery,
  selection: PageFilters,
  widgetDisplayType?: DisplayType
): EventView {
  const {start, end, period: statsPeriod} = selection.datetime;
  const {projects, environments} = selection;

  // World Map requires an additional column (geo.country_code) to display in discover when navigating from the widget
  const fields =
    widgetDisplayType === DisplayType.WORLD_MAP &&
    !query.columns.includes('geo.country_code')
      ? ['geo.country_code', ...query.columns, ...query.aggregates]
      : [...query.columns, ...query.aggregates];
  const conditions =
    widgetDisplayType === DisplayType.WORLD_MAP &&
    !query.conditions.includes('has:geo.country_code')
      ? `${query.conditions} has:geo.country_code`.trim()
      : query.conditions;

  const {orderby} = query;
  // Need to convert orderby to aggregate alias because eventView still uses aggregate alias format
  const aggregateAliasOrderBy = orderby
    ? `${orderby.startsWith('-') ? '-' : ''}${getAggregateAlias(trimStart(orderby, '-'))}`
    : orderby;
  return EventView.fromSavedQuery({
    id: undefined,
    name: title,
    version: 2,
    fields,
    query: conditions,
    orderby: aggregateAliasOrderBy,
    projects,
    range: statsPeriod ?? undefined,
    start: start ? getUtcDateString(start) : undefined,
    end: end ? getUtcDateString(end) : undefined,
    environment: environments,
  });
}

function coerceStringToArray(value?: string | string[] | null) {
  return typeof value === 'string' ? [value] : value;
}

export function constructWidgetFromQuery(query?: Query): Widget | undefined {
  if (query) {
    const queryNames = coerceStringToArray(query.queryNames);
    const queryConditions = coerceStringToArray(query.queryConditions);
    const queryFields = coerceStringToArray(query.queryFields);
    const queries: WidgetQuery[] = [];
    if (
      queryConditions &&
      queryNames &&
      queryFields &&
      typeof query.queryOrderby === 'string'
    ) {
      const {columns, aggregates} = getColumnsAndAggregates(queryFields);
      queryConditions.forEach((condition, index) => {
        queries.push({
          name: queryNames[index],
          conditions: condition,
          fields: queryFields,
          columns,
          aggregates,
          orderby: query.queryOrderby as string,
        });
      });
    }
    if (query.title && query.displayType && query.interval && queries.length > 0) {
      const newWidget: Widget = {
        ...(pick(query, ['title', 'displayType', 'interval']) as {
          displayType: DisplayType;
          interval: string;
          title: string;
        }),
        widgetType: WidgetType.DISCOVER,
        queries,
      };
      return newWidget;
    }
  }
  return undefined;
}

export function miniWidget(displayType: DisplayType): string {
  switch (displayType) {
    case DisplayType.BAR:
      return WidgetBar;
    case DisplayType.AREA:
    case DisplayType.TOP_N:
      return WidgetArea;
    case DisplayType.BIG_NUMBER:
      return WidgetBigNumber;
    case DisplayType.TABLE:
      return WidgetTable;
    case DisplayType.WORLD_MAP:
      return WidgetWorldMap;
    case DisplayType.LINE:
    default:
      return WidgetLine;
  }
}

export function getWidgetInterval(
  displayType: DisplayType,
  datetimeObj: Partial<PageFilters['datetime']>,
  widgetInterval?: string,
  fidelity?: Fidelity
): string {
  // Don't fetch more than 66 bins as we're plotting on a small area.
  const MAX_BIN_COUNT = 66;

  // Bars charts are daily totals to aligned with discover. It also makes them
  // usefully different from line/area charts until we expose the interval control, or remove it.
  let interval = displayType === 'bar' ? '1d' : widgetInterval;
  if (!interval) {
    // Default to 5 minutes
    interval = '5m';
  }
  const desiredPeriod = parsePeriodToHours(interval);
  const selectedRange = getDiffInMinutes(datetimeObj);

  if (fidelity) {
    // Primarily to support lower fidelity for Release Health widgets
    // the sort on releases and hit the metrics API endpoint.
    interval = getInterval(datetimeObj, fidelity);
    if (selectedRange > SIX_HOURS && selectedRange <= TWENTY_FOUR_HOURS) {
      interval = '1h';
    }
    return displayType === 'bar' ? '1d' : interval;
  }

  // selectedRange is in minutes, desiredPeriod is in hours
  // convert desiredPeriod to minutes
  if (selectedRange / (desiredPeriod * 60) > MAX_BIN_COUNT) {
    const highInterval = getInterval(datetimeObj, 'high');
    // Only return high fidelity interval if desired interval is higher fidelity
    if (desiredPeriod < parsePeriodToHours(highInterval)) {
      return highInterval;
    }
  }
  return interval;
}

export function getFieldsFromEquations(fields: string[]): string[] {
  // Gather all fields and functions used in equations and prepend them to the provided fields
  const termsSet: Set<string> = new Set();
  fields.filter(isEquation).forEach(field => {
    const parsed = parseArithmetic(stripEquationPrefix(field)).tc;
    parsed.fields.forEach(({term}) => termsSet.add(term as string));
    parsed.functions.forEach(({term}) => termsSet.add(term as string));
  });
  return Array.from(termsSet);
}

export function getWidgetDiscoverUrl(
  widget: Widget,
  selection: PageFilters,
  organization: Organization,
  index: number = 0,
  isMetricsData: boolean = false
) {
  const eventView = eventViewFromWidget(
    widget.title,
    widget.queries[index],
    selection,
    widget.displayType
  );
  const discoverLocation = eventView.getResultsViewUrlTarget(organization.slug);

  // Pull a max of 3 valid Y-Axis from the widget
  const yAxisOptions = eventView.getYAxisOptions().map(({value}) => value);
  discoverLocation.query.yAxis = [
    ...new Set(
      widget.queries[0].aggregates.filter(aggregate => yAxisOptions.includes(aggregate))
    ),
  ].slice(0, 3);

  // Visualization specific transforms
  switch (widget.displayType) {
    case DisplayType.WORLD_MAP:
      discoverLocation.query.display = DisplayModes.WORLDMAP;
      break;
    case DisplayType.BAR:
      discoverLocation.query.display = DisplayModes.BAR;
      break;
    case DisplayType.TOP_N:
      discoverLocation.query.display = DisplayModes.TOP5;
      // Last field is used as the yAxis
      const aggregates = widget.queries[0].aggregates;
      discoverLocation.query.yAxis = aggregates[aggregates.length - 1];
      if (aggregates.slice(0, -1).includes(aggregates[aggregates.length - 1])) {
        discoverLocation.query.field = aggregates.slice(0, -1);
      }
      break;
    default:
      break;
  }

  // Equation fields need to have their terms explicitly selected as columns in the discover table
  const fields = discoverLocation.query.field;
  const query = widget.queries[0];
  const queryFields = defined(query.fields)
    ? query.fields
    : [...query.columns, ...query.aggregates];
  const equationFields = getFieldsFromEquations(queryFields);
  // Updates fields by adding any individual terms from equation fields as a column
  equationFields.forEach(term => {
    if (Array.isArray(fields) && !fields.includes(term)) {
      fields.unshift(term);
    }
  });

  if (isMetricsData) {
    discoverLocation.query.fromMetric = 'true';
  }

  // Construct and return the discover url
  const discoverPath = `${discoverLocation.pathname}?${qs.stringify({
    ...discoverLocation.query,
  })}`;
  return discoverPath;
}

export function getWidgetIssueUrl(
  widget: Widget,
  selection: PageFilters,
  organization: Organization
) {
  const {start, end, utc, period} = selection.datetime;
  const datetime =
    start && end
      ? {start: getUtcDateString(start), end: getUtcDateString(end), utc}
      : {statsPeriod: period};
  const issuesLocation = `/organizations/${organization.slug}/issues/?${qs.stringify({
    query: widget.queries?.[0]?.conditions,
    sort: widget.queries?.[0]?.orderby,
    ...datetime,
    project: selection.projects,
    environment: selection.environments,
  })}`;
  return issuesLocation;
}

export function getWidgetReleasesUrl(
  _widget: Widget,
  selection: PageFilters,
  organization: Organization
) {
  const {start, end, utc, period} = selection.datetime;
  const datetime =
    start && end
      ? {start: getUtcDateString(start), end: getUtcDateString(end), utc}
      : {statsPeriod: period};
  const releasesLocation = `/organizations/${organization.slug}/releases/?${qs.stringify({
    ...datetime,
    project: selection.projects,
    environment: selection.environments,
  })}`;
  return releasesLocation;
}

export function flattenErrors(
  data: ValidationError | string,
  update: FlatValidationError
): FlatValidationError {
  if (typeof data === 'string') {
    update.error = data;
  } else {
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
        (value as ValidationError[]).map(item => flattenErrors(item, update));
      } else {
        flattenErrors(value as ValidationError, update);
      }
    });
  }
  return update;
}

export function getDashboardsMEPQueryParams(isMEPEnabled: boolean) {
  return isMEPEnabled
    ? {
        dataset: 'metricsEnhanced',
      }
    : {};
}

export function getNumEquations(possibleEquations: string[]) {
  return possibleEquations.filter(isEquation).length;
}

const DEFINED_MEASUREMENTS = new Set(Object.keys(getMeasurements()));
export function isCustomMeasurement(field: string) {
  return !DEFINED_MEASUREMENTS.has(field) && isMeasurement(field);
}

export function isCustomMeasurementWidget(widget: Widget) {
  return (
    widget.widgetType === WidgetType.DISCOVER &&
    widget.queries.some(({aggregates, columns, fields}) => {
      const aggregateArgs = aggregates.reduce((acc: string[], aggregate) => {
        // Should be ok to use getAggregateArg. getAggregateArg only returns the first arg
        // but there aren't any custom measurement aggregates that use custom measurements
        // outside of the first arg.
        const aggregateArg = getAggregateArg(aggregate);
        if (aggregateArg) {
          acc.push(aggregateArg);
        }
        return acc;
      }, []);
      return [...aggregateArgs, ...columns, ...(fields ?? [])].some(field =>
        isCustomMeasurement(field)
      );
    })
  );
}

export function getCustomMeasurementQueryParams() {
  return {
    dataset: 'metrics',
  };
}

export function isWidgetUsingTransactionName(widget: Widget) {
  return (
    widget.widgetType === WidgetType.DISCOVER &&
    widget.queries.some(({aggregates, columns, fields, conditions}) => {
      const aggregateArgs = aggregates.reduce((acc: string[], aggregate) => {
        const aggregateArg = getAggregateArg(aggregate);
        if (aggregateArg) {
          acc.push(aggregateArg);
        }
        return acc;
      }, []);
      const transactionSelected = [...aggregateArgs, ...columns, ...(fields ?? [])].some(
        field => field === 'transaction'
      );
      const transactionUsedInFilter = parseSearch(conditions)?.some(
        parsedCondition =>
          parsedCondition.type === Token.Filter &&
          parsedCondition.key?.text === 'transaction'
      );
      return transactionSelected || transactionUsedInFilter;
    })
  );
}

export function hasSavedPageFilters(dashboard: DashboardDetails) {
  return !(
    isEmpty(dashboard.projects) &&
    dashboard.environment === undefined &&
    dashboard.start === undefined &&
    dashboard.end === undefined &&
    dashboard.period === undefined
  );
}

export function hasUnsavedFilterChanges(
  initialDashboard: DashboardDetails,
  location: Location
) {
  // Use Sets to compare the filter fields that are arrays
  type Filters = {
    end?: string;
    environment?: Set<string>;
    period?: string;
    projects?: Set<number>;
    release?: Set<string>;
    start?: string;
    utc?: boolean;
  };

  const savedFilters: Filters = {
    projects: new Set(initialDashboard.projects),
    environment: new Set(initialDashboard.environment),
    period: initialDashboard.period,
    start: normalizeDateTimeString(initialDashboard.start),
    end: normalizeDateTimeString(initialDashboard.end),
    utc: initialDashboard.utc,
  };
  let currentFilters = {
    ...getCurrentPageFilters(location),
  } as unknown as Filters;
  currentFilters = {
    ...currentFilters,
    projects: new Set(currentFilters.projects),
    environment: new Set(currentFilters.environment),
  };

  if (defined(location.query?.release)) {
    // Release is only included in the comparison if it exists in the query
    // params, otherwise the dashboard should be using its saved state
    savedFilters.release = new Set(initialDashboard.filters?.release);
    currentFilters.release = new Set(location.query?.release);
  }

  return !isEqual(savedFilters, currentFilters);
}

export function getSavedFiltersAsPageFilters(dashboard: DashboardDetails): PageFilters {
  return {
    datetime: {
      end: dashboard.end || null,
      period: dashboard.period || null,
      start: dashboard.start || null,
      utc: null,
    },
    environments: dashboard.environment || [],
    projects: dashboard.projects || [],
  };
}

export function getSavedPageFilters(dashboard: DashboardDetails) {
  return {
    project: dashboard.projects,
    environment: dashboard.environment,
    statsPeriod: dashboard.period,
    start: normalizeDateTimeString(dashboard.start),
    end: normalizeDateTimeString(dashboard.end),
    utc: dashboard.utc,
  };
}

export function resetPageFilters(dashboard: DashboardDetails, location: Location) {
  browserHistory.replace({
    ...location,
    query: getSavedPageFilters(dashboard),
  });
}

export function getCurrentPageFilters(
  location: Location
): Pick<
  DashboardDetails,
  'projects' | 'environment' | 'period' | 'start' | 'end' | 'utc'
> {
  const {project, environment, statsPeriod, start, end, utc} = location.query ?? {};
  return {
    // Ensure projects and environment are sent as arrays, or undefined in the request
    // location.query will return a string if there's only one value
    projects:
      project === undefined || project === null
        ? []
        : typeof project === 'string'
        ? [Number(project)]
        : project.map(Number),
    environment:
      typeof environment === 'string' ? [environment] : environment ?? undefined,
    period: statsPeriod as string | undefined,
    start: defined(start) ? normalizeDateTimeString(start as string) : undefined,
    end: defined(end) ? normalizeDateTimeString(end as string) : undefined,
    utc: defined(utc) ? utc === 'true' : undefined,
  };
}

export function getDashboardFiltersFromURL(location: Location): DashboardFilters | null {
  const dashboardFilters: DashboardFilters = {};
  Object.values(DashboardFilterKeys).forEach(key => {
    if (defined(location.query?.[key])) {
      dashboardFilters[key] = decodeList(location.query?.[key]);
    }
  });
  return !isEmpty(dashboardFilters) ? dashboardFilters : null;
}

export function dashboardFiltersToString(
  dashboardFilters: DashboardFilters | null | undefined
): string {
  let dashboardFilterConditions = '';
  if (dashboardFilters) {
    for (const [key, activeFilters] of Object.entries(dashboardFilters)) {
      if (activeFilters.length === 1) {
        dashboardFilterConditions += `${key}:${activeFilters[0]} `;
      } else if (activeFilters.length > 1) {
        dashboardFilterConditions += `${key}:[${activeFilters.join(',')}] `;
      }
    }
  }
  return dashboardFilterConditions;
}
