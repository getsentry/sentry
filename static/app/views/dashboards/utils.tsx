import {connect} from 'echarts';
import type {Location, Query} from 'history';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import trimStart from 'lodash/trimStart';
import * as qs from 'query-string';

import WidgetArea from 'sentry-images/dashboard/widget-area.svg';
import WidgetBar from 'sentry-images/dashboard/widget-bar.svg';
import WidgetBigNumber from 'sentry-images/dashboard/widget-big-number.svg';
import WidgetLine from 'sentry-images/dashboard/widget-line-1.svg';
import WidgetTable from 'sentry-images/dashboard/widget-table.svg';

import {parseArithmetic} from 'sentry/components/arithmeticInput/parser';
import type {Fidelity} from 'sentry/components/charts/utils';
import {
  getDiffInMinutes,
  getInterval,
  SIX_HOURS,
  TWENTY_FOUR_HOURS,
} from 'sentry/components/charts/utils';
import {normalizeDateTimeString} from 'sentry/components/organizations/pageFilters/parse';
import {parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {browserHistory} from 'sentry/utils/browserHistory';
import {getUtcDateString} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import {DURATION_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {
  getAggregateAlias,
  getAggregateArg,
  getColumnsAndAggregates,
  isEquation,
  isMeasurement,
  RATE_UNIT_MULTIPLIERS,
  RateUnit,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {
  DiscoverDatasets,
  DisplayModes,
  type SavedQueryDatasets,
} from 'sentry/utils/discover/types';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {getMeasurements} from 'sentry/utils/measurements/measurements';
import {getMetricDisplayType, getMetricsUrl} from 'sentry/utils/metrics';
import {parseField} from 'sentry/utils/metrics/mri';
import type {MetricsWidget} from 'sentry/utils/metrics/types';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import type {
  DashboardDetails,
  DashboardFilters,
  Widget,
  WidgetQuery,
} from 'sentry/views/dashboards/types';
import {
  DashboardFilterKeys,
  DisplayType,
  WIDGET_TYPE_TO_SAVED_QUERY_DATASET,
  WidgetType,
} from 'sentry/views/dashboards/types';

import type {ThresholdsConfig} from './widgetBuilder/buildSteps/thresholdsStep/thresholdsStep';

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
  selection: PageFilters
): EventView {
  const {start, end, period: statsPeriod} = selection.datetime;
  const {projects, environments} = selection;

  // World Map requires an additional column (geo.country_code) to display in discover when navigating from the widget
  const fields = [...query.columns, ...query.aggregates];
  const conditions = query.conditions;

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

export function getThresholdUnitSelectOptions(
  dataType: string
): {label: string; value: string}[] {
  if (dataType === 'duration') {
    return Object.keys(DURATION_UNITS)
      .map(unit => ({label: unit, value: unit}))
      .slice(2);
  }

  if (dataType === 'rate') {
    return Object.values(RateUnit).map(unit => ({
      label: `/${unit.split('/')[1]}`,
      value: unit,
    }));
  }

  return [];
}

export function hasThresholdMaxValue(thresholdsConfig: ThresholdsConfig): boolean {
  return Object.keys(thresholdsConfig.max_values).length > 0;
}

export function normalizeUnit(value: number, unit: string, dataType: string): number {
  const multiplier =
    dataType === 'rate'
      ? RATE_UNIT_MULTIPLIERS[unit]
      : dataType === 'duration'
        ? DURATION_UNITS[unit]
        : 1;
  return value * multiplier;
}

function coerceStringToArray(value?: string | string[] | null) {
  return typeof value === 'string' ? [value] : value;
}

export function constructWidgetFromQuery(query?: Query): Widget | undefined {
  if (query) {
    const queryNames = coerceStringToArray(query.queryNames);
    const queryConditions = coerceStringToArray(query.queryConditions);
    const queryFields = coerceStringToArray(query.queryFields);
    const widgetType = decodeScalar(query.widgetType);
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
          name: queryNames[index]!,
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
        widgetType: widgetType ? (widgetType as WidgetType) : WidgetType.DISCOVER,
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
  const eventView = eventViewFromWidget(widget.title, widget.queries[index]!, selection);
  const discoverLocation = eventView.getResultsViewUrlTarget(
    organization.slug,
    false,
    hasDatasetSelector(organization) && widget.widgetType
      ? WIDGET_TYPE_TO_SAVED_QUERY_DATASET[widget.widgetType]
      : undefined
  );

  // Pull a max of 3 valid Y-Axis from the widget
  const yAxisOptions = eventView.getYAxisOptions().map(({value}) => value);
  discoverLocation.query.yAxis = [
    ...new Set(
      widget.queries[0]!.aggregates.filter(aggregate => yAxisOptions.includes(aggregate))
    ),
  ].slice(0, 3);

  // Visualization specific transforms
  switch (widget.displayType) {
    case DisplayType.BAR:
      discoverLocation.query.display = DisplayModes.BAR;
      break;
    case DisplayType.TOP_N:
      discoverLocation.query.display = DisplayModes.TOP5;
      // Last field is used as the yAxis
      const aggregates = widget.queries[0]!.aggregates;
      discoverLocation.query.yAxis = aggregates[aggregates.length - 1];
      if (aggregates.slice(0, -1).includes(aggregates[aggregates.length - 1]!)) {
        discoverLocation.query.field = aggregates.slice(0, -1);
      }
      break;
    default:
      break;
  }

  // Equation fields need to have their terms explicitly selected as columns in the discover table
  const fields =
    Array.isArray(discoverLocation.query.field) || !discoverLocation.query.field
      ? discoverLocation.query.field
      : [discoverLocation.query.field];

  const query = widget.queries[0]!;
  const queryFields = defined(query.fields)
    ? query.fields
    : [...query.columns, ...query.aggregates];

  // Updates fields by adding any individual terms from equation fields as a column
  getFieldsFromEquations(queryFields).forEach(term => {
    if (Array.isArray(fields) && !fields.includes(term)) {
      fields.unshift(term);
    }
  });
  discoverLocation.query.field = fields;

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

export function getWidgetMetricsUrl(
  _widget: Widget,
  selection: PageFilters,
  organization: Organization
) {
  const {start, end, utc, period} = selection.datetime;
  const datetime =
    start && end
      ? {start: getUtcDateString(start), end: getUtcDateString(end), utc}
      : {statsPeriod: period};

  // ensures that My Projects selection is properly handled
  const project = selection.projects.length ? selection.projects : [0];

  const metricsLocation = getMetricsUrl(organization.slug, {
    ...datetime,
    project,
    environment: selection.environments,
    widgets: _widget.queries.map(query => {
      const parsed = parseField(query.aggregates[0]!);

      return {
        mri: parsed?.mri,
        aggregation: parsed?.aggregation,
        groupBy: query.columns,
        query: query.conditions ?? '',
        displayType: getMetricDisplayType(_widget.displayType),
      } satisfies Partial<MetricsWidget>;
    }),
  });

  return metricsLocation;
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
        dataset: DiscoverDatasets.METRICS_ENHANCED,
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
          parsedCondition.type === Token.FILTER &&
          parsedCondition.key?.text === 'transaction'
      );
      return transactionSelected || transactionUsedInFilter;
    })
  );
}

export function hasSavedPageFilters(dashboard: DashboardDetails) {
  return !(
    dashboard.projects &&
    dashboard.projects.length === 0 &&
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
  return Object.keys(dashboardFilters).length > 0 ? dashboardFilters : null;
}

export function dashboardFiltersToString(
  dashboardFilters: DashboardFilters | null | undefined
): string {
  let dashboardFilterConditions = '';
  if (dashboardFilters) {
    for (const [key, activeFilters] of Object.entries(dashboardFilters)) {
      if (activeFilters.length === 1) {
        dashboardFilterConditions += `${key}:"${activeFilters[0]}" `;
      } else if (activeFilters.length > 1) {
        dashboardFilterConditions += `${key}:[${activeFilters
          .map(f => `"${f}"`)
          .join(',')}] `;
      }
    }
  }
  return dashboardFilterConditions;
}

export function connectDashboardCharts(groupName: string) {
  connect?.(groupName);
}

export function hasDatasetSelector(organization: Organization): boolean {
  return organization.features.includes('performance-discover-dataset-selector');
}

export function appendQueryDatasetParam(
  organization: Organization,
  queryDataset?: SavedQueryDatasets
) {
  if (hasDatasetSelector(organization) && queryDataset) {
    return {queryDataset};
  }
  return {};
}

/**
 * Checks if the widget is using the performance_score aggregate
 */
export function isUsingPerformanceScore(widget: Widget) {
  if (widget.queries.length === 0) {
    return false;
  }
  return widget.queries.some(_doesWidgetUsePerformanceScore);
}

function _doesWidgetUsePerformanceScore(query: WidgetQuery) {
  if (query.conditions?.includes('performance_score')) {
    return true;
  }
  if (query.aggregates.some(aggregate => aggregate.includes('performance_score'))) {
    return true;
  }

  return false;
}

export const performanceScoreTooltip = t('peformance_score is not supported in Discover');
