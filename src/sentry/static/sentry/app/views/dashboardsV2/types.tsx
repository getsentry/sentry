import {Field} from 'app/utils/discover/fields';

type DisplayType = 'line' | 'area' | 'stacked_area' | 'bar' | 'table';

type WidgetQuery = {
  name: string;
  fields: Field[];
  conditions: string;
  interval?: string; // not required
};

type Widget = {
  title: string;
  displayType: DisplayType;
  queries: WidgetQuery[];
};

export type Dashboard = {
  name: string;
  widgets: Widget[];
};

export type PrebuiltDashboard = {
  type: 'prebuilt';
  dashboard: Dashboard;
};

export type UserDashboard = {
  type: 'org';
  dashboard: Dashboard;
  author: string;
  dateAdded: number;
};

export type DashboardListItem = PrebuiltDashboard | UserDashboard;
