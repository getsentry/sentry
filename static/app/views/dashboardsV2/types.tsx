import {User} from 'app/types';

// Max widgets per dashboard we are currently willing
// to allow to limit the load on snuba from the
// parallel requests. Somewhat arbitrary
// limit that can be changed if necessary.
export const MAX_WIDGETS = 30;

export enum DisplayType {
  AREA = 'area',
  BAR = 'bar',
  LINE = 'line',
  TABLE = 'table',
  WORLD_MAP = 'world_map',
  BIG_NUMBER = 'big_number',
  STACKED_AREA = 'stacked_area',
  TOP_N = 'top_n',
}

export type WidgetQuery = {
  name: string;
  fields: string[];
  conditions: string;
  orderby: string;
};

export type Widget = {
  id?: string;
  title: string;
  displayType: DisplayType;
  interval: string;
  queries: WidgetQuery[];
};

/**
 * The response shape from dashboard list endpoint
 */
export type DashboardListItem = {
  id: string;
  title: string;
  dateCreated?: string;
  createdBy?: User;
  widgetDisplay: DisplayType[];
};

/**
 * Saved dashboard with widgets
 */
export type DashboardDetails = {
  title: string;
  widgets: Widget[];
  id: string;
  dateCreated: string;
  createdBy?: User;
};

export enum DashboardState {
  VIEW = 'view',
  EDIT = 'edit',
  CREATE = 'create',
  PENDING_DELETE = 'pending_delete',
}
