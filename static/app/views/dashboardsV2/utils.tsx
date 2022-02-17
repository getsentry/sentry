import {Query} from 'history';
import cloneDeep from 'lodash/cloneDeep';
import pick from 'lodash/pick';
import * as qs from 'query-string';

import WidgetArea from 'sentry-images/dashboard/widget-area.svg';
import WidgetBar from 'sentry-images/dashboard/widget-bar.svg';
import WidgetBigNumber from 'sentry-images/dashboard/widget-big-number.svg';
import WidgetLine from 'sentry-images/dashboard/widget-line-1.svg';
import WidgetTable from 'sentry-images/dashboard/widget-table.svg';
import WidgetWorldMap from 'sentry-images/dashboard/widget-world-map.svg';

import {parseArithmetic} from 'sentry/components/arithmeticInput/parser';
import {getDiffInMinutes, getInterval} from 'sentry/components/charts/utils';
import {Organization, PageFilters} from 'sentry/types';
import {getUtcDateString, parsePeriodToHours} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import {isEquation, stripEquationPrefix} from 'sentry/utils/discover/fields';
import {DisplayModes} from 'sentry/utils/discover/types';
import {
  DashboardDetails,
  DisplayType,
  Widget,
  WidgetQuery,
  WidgetType,
} from 'sentry/views/dashboardsV2/types';

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
    !query.fields.includes('geo.country_code')
      ? ['geo.country_code', ...query.fields]
      : query.fields;
  const conditions =
    widgetDisplayType === DisplayType.WORLD_MAP &&
    !query.conditions.includes('has:geo.country_code')
      ? `${query.conditions} has:geo.country_code`.trim()
      : query.conditions;

  return EventView.fromSavedQuery({
    id: undefined,
    name: title,
    version: 2,
    fields,
    query: conditions,
    orderby: query.orderby,
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
      queryConditions.forEach((condition, index) => {
        queries.push({
          name: queryNames[index],
          conditions: condition,
          fields: queryFields,
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
  widget: Widget,
  datetimeObj: Partial<PageFilters['datetime']>
): string {
  // Don't fetch more than 66 bins as we're plotting on a small area.
  const MAX_BIN_COUNT = 66;

  // Bars charts are daily totals to aligned with discover. It also makes them
  // usefully different from line/area charts until we expose the interval control, or remove it.
  let interval = widget.displayType === 'bar' ? '1d' : widget.interval;
  if (!interval) {
    // Default to 5 minutes
    interval = '5m';
  }
  const desiredPeriod = parsePeriodToHours(interval);
  const selectedRange = getDiffInMinutes(datetimeObj);

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
  organization: Organization
) {
  const eventView = eventViewFromWidget(
    widget.title,
    widget.queries[0],
    selection,
    widget.displayType
  );
  const discoverLocation = eventView.getResultsViewUrlTarget(organization.slug);

  // Pull a max of 3 valid Y-Axis from the widget
  const yAxisOptions = eventView.getYAxisOptions().map(({value}) => value);
  discoverLocation.query.yAxis = [
    ...new Set(widget.queries[0].fields.filter(field => yAxisOptions.includes(field))),
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
      const fields = widget.queries[0].fields;
      discoverLocation.query.yAxis = fields[fields.length - 1];
      if (fields.slice(0, -1).includes(fields[fields.length - 1])) {
        discoverLocation.query.field = fields.slice(0, -1);
      }
      break;
    default:
      break;
  }

  // Equation fields need to have their terms explicitly selected as columns in the discover table
  const fields = discoverLocation.query.field;
  const equationFields = getFieldsFromEquations(widget.queries[0].fields);
  // Updates fields by adding any individual terms from equation fields as a column
  equationFields.forEach(term => {
    if (Array.isArray(fields) && !fields.includes(term)) {
      fields.unshift(term);
    }
  });

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
  })}`;
  return issuesLocation;
}
