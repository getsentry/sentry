type DisplayType = 'line' | 'area' | 'stacked_area' | 'bar' | 'table' | 'world_map';

export type WidgetQuery = {
  name: string;
  fields: string[];
  conditions: string;
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
