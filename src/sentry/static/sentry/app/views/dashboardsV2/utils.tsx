import cloneDeep from 'lodash/cloneDeep';

import {GlobalSelection} from 'app/types';
import {getUtcDateString} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';

import {DashboardDetails, WidgetQuery} from './types';

export function cloneDashboard(dashboard: DashboardDetails): DashboardDetails {
  return cloneDeep(dashboard);
}

export function eventViewFromWidgetQuery(
  query: WidgetQuery,
  selection: GlobalSelection
): EventView {
  const {start, end, period: statsPeriod} = selection.datetime;
  const {projects} = selection;

  return EventView.fromSavedQuery({
    id: undefined,
    name: query.name,
    version: 2,
    fields: query.fields,
    query: query.conditions,
    orderby: query.orderby,
    projects,
    range: statsPeriod,
    start: start ? getUtcDateString(start) : undefined,
    end: end ? getUtcDateString(end) : undefined,
  });
}
