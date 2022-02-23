import {Layout} from 'react-grid-layout';

import {User} from 'sentry/types';

// Max widgets per dashboard we are currently willing
// to allow to limit the load on snuba from the
// parallel requests. Somewhat arbitrary
// limit that can be changed if necessary.
export const MAX_WIDGETS = 30;

export const DEFAULT_TABLE_LIMIT = 5;

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

export enum WidgetType {
  DISCOVER = 'discover',
  ISSUE = 'issue',
  METRICS = 'metrics',
}

export type WidgetQuery = {
  conditions: string;
  fields: string[];
  name: string;
  orderby: string;
};

export type Widget = {
  displayType: DisplayType;
  interval: string;
  queries: WidgetQuery[];
  title: string;
  id?: string;
  layout?: WidgetLayout | null;
  tempId?: string;
  widgetType?: WidgetType;
};

// We store an explicit set of keys in the backend now
export type WidgetLayout = Pick<Layout, 'h' | 'w' | 'x' | 'y'> & {
  minH: number;
};

export type WidgetPreview = {
  displayType: DisplayType;
  layout: WidgetLayout | null;
};

/**
 * The response shape from dashboard list endpoint
 */
export type DashboardListItem = {
  id: string;
  title: string;
  widgetDisplay: DisplayType[];
  widgetPreview: WidgetPreview[];
  createdBy?: User;
  dateCreated?: string;
};

/**
 * Saved dashboard with widgets
 */
export type DashboardDetails = {
  dateCreated: string;
  id: string;
  title: string;
  widgets: Widget[];
  createdBy?: User;
};

export enum DashboardState {
  VIEW = 'view',
  EDIT = 'edit',
  CREATE = 'create',
  PENDING_DELETE = 'pending_delete',
  PREVIEW = 'preview',
}

// where we launch the dashboard widget from
export enum DashboardWidgetSource {
  DISCOVERV2 = 'discoverv2',
  DASHBOARDS = 'dashboards',
  LIBRARY = 'library',
  ISSUE_DETAILS = 'issueDetail',
}
