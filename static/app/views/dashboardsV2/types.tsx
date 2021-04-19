export enum DisplayType {
  AREA = 'area',
  BAR = 'bar',
  LINE = 'line',
  TABLE = 'table',
  WORLD_MAP = 'world_map',
  BIG_NUMBER = 'big_number',
  STACKED_AREA = 'stacked_area',
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
  dateCreated: string;
  createdBy: string;
};

/**
 * Saved dashboard with widgets
 */
export type DashboardDetails = {
  title: string;
  widgets: Widget[];
  id: string;
  dateCreated: string;
  createdBy: string;
};

export type DashboardState = 'view' | 'edit' | 'create' | 'pending_delete';
