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

export type DashboardListItem =
  | {
      type: 'prebuilt';
      dashboard: Dashboard;
    }
  | {
      type: 'user';
      dashboard: Dashboard;
      author: string;
      dateAdded: number;
    };
