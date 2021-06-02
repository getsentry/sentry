import cloneDeep from 'lodash/cloneDeep';

import {GlobalSelection} from 'app/types';
import {getUtcDateString} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';

import {DashboardDetails, WidgetQuery} from './types';

export function cloneDashboard(dashboard: DashboardDetails): DashboardDetails {
  return cloneDeep(dashboard);
}

export function eventViewFromWidget(
  title: string,
  query: WidgetQuery,
  selection: GlobalSelection
): EventView {
  const {start, end, period: statsPeriod} = selection.datetime;
  const {projects, environments} = selection;

  return EventView.fromSavedQuery({
    id: undefined,
    name: title,
    version: 2,
    fields: query.fields,
    query: query.conditions,
    orderby: query.orderby,
    projects,
    range: statsPeriod,
    start: start ? getUtcDateString(start) : undefined,
    end: end ? getUtcDateString(end) : undefined,
    environment: environments,
  });
}

const BANNER_DISMISSED_KEY = 'dashboard-banner-dismissed';

export function isBannerHidden(): boolean {
  return localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
}
export function setBannerHidden(value: boolean) {
  localStorage.setItem(BANNER_DISMISSED_KEY, value ? 'true' : 'false');
}
