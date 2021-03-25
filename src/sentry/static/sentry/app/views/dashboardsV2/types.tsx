import {User} from 'app/types';

export type DisplayType =
  | 'line'
  | 'area'
  | 'stacked_area'
  | 'bar'
  | 'table'
  | 'world_map'
  | 'big_number';

export type WidgetQuery = {
  name: string;
  fields: string[];
  conditions: string;
  orderby: string;
};

export type ThinWidget = {
  id?: string;
  title: string;
  displayType: DisplayType;
  interval: string;
};

export type Widget = ThinWidget & {
  queries: WidgetQuery[];
};

/**
 * The response shape from dashboard list endpoint
 */
export type DashboardListItem = {
  id: string;
  title: string;
  dateCreated: string;
};

export type DashboardDetailedListItem = DashboardListItem & {
  createdBy: User;
  widgets: ThinWidget[];
};

export type DashboardDetails = DashboardListItem & {
  widgets: Widget[];
};

export type DashboardState = 'view' | 'edit' | 'create' | 'pending_delete';
