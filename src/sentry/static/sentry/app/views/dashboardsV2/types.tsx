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

export type PrebuiltDashboard = {
  type: 'prebuilt';
  title: string;
  widgets: Widget[];
};

export type OrgDashboard = {
  type: 'org';
} & OrgDashboardResponse;

export type DashboardListItem = PrebuiltDashboard | OrgDashboard;

export type DashboardState = 'default' | 'edit' | 'create';

// POST response when creating a new dashboard
export type OrgDashboardResponse = {
  title: string;
  dateCreated: string;
  createdBy: string;
  widgets: Widget[];
  organization: string;
  id: string;
};

// PUT body for updating a dashboard
export type OrgDashboardUpdate = {
  title: string;
  widgets: Array<{id: string}>;
};
