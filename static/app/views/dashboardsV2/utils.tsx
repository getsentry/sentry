import cloneDeep from 'lodash/cloneDeep';

import {GlobalSelection} from 'app/types';
import {getUtcDateString} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';

import {DashboardDetails, DisplayType, WidgetQuery} from './types';

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
