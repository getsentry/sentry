import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import space from 'app/styles/space';
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
  const {projects} = selection;

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
  });
}

export const WidgetContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-flow: row dense;
  grid-gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: repeat(4, 1fr);
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: repeat(6, 1fr);
  }

  @media (min-width: ${p => p.theme.breakpoints[4]}) {
    grid-template-columns: repeat(8, 1fr);
  }
`;
