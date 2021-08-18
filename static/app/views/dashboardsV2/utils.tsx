import cloneDeep from 'lodash/cloneDeep';
import pick from 'lodash/pick';

import {GlobalSelection} from 'app/types';
import {getUtcDateString} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';

import {DashboardDetails, DisplayType, Widget, WidgetQuery} from './types';

export function cloneDashboard(dashboard: DashboardDetails): DashboardDetails {
  return cloneDeep(dashboard);
}

export function eventViewFromWidget(
  title: string,
  query: WidgetQuery,
  selection: GlobalSelection,
  widgetType?: DisplayType
): EventView {
  const {start, end, period: statsPeriod} = selection.datetime;
  const {projects, environments} = selection;

  // World Map requires an additional column (geo.country_code) to display in discover when navigating from the widget
  const fields =
    widgetType === DisplayType.WORLD_MAP
      ? ['geo.country_code', ...query.fields]
      : query.fields;
  const conditions =
    widgetType === DisplayType.WORLD_MAP
      ? `${query.conditions} has:geo.country_code`
      : query.conditions;

  return EventView.fromSavedQuery({
    id: undefined,
    name: title,
    version: 2,
    fields,
    query: conditions,
    orderby: query.orderby,
    projects,
    range: statsPeriod,
    start: start ? getUtcDateString(start) : undefined,
    end: end ? getUtcDateString(end) : undefined,
    environment: environments,
  });
}

export function constructWidgetFromQuery(query): Widget | undefined {
  if (query) {
    const queryNames =
      typeof query.queryNames === 'string' ? [query.queryNames] : query.queryNames;
    const queryConditions =
      typeof query.queryConditions === 'string'
        ? [query.queryConditions]
        : query.queryConditions;
    const queries: WidgetQuery[] = [];
    if (queryConditions)
      queryConditions.forEach((condition, index) => {
        queries.push({
          name: queryNames?.[index],
          conditions: condition,
          fields:
            typeof query.queryFields === 'string'
              ? [query.queryFields]
              : query.queryFields,
          orderby: query.queryOrderby,
        });
      });
    const newWidget: Widget = {
      ...pick(query, ['title', 'displayType', 'interval']),
      queries,
    };
    // TODO: more elegant way to check if newWidget is valid?
    if (Object.keys(newWidget).length === 4) return newWidget;
  }
  return undefined;
}
