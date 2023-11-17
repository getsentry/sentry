import {Layout} from 'react-grid-layout';

import {User} from 'sentry/types';

import {ThresholdsConfig} from './widgetBuilder/buildSteps/thresholdsStep/thresholdsStep';

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
  BIG_NUMBER = 'big_number',
  TOP_N = 'top_n',
}

export enum WidgetType {
  DISCOVER = 'discover',
  ISSUE = 'issue',
  RELEASE = 'metrics', // TODO(ddm): rename RELEASE to 'release', and METRICS to 'metrics'
  METRICS = 'custom-metrics',
}

export type WidgetQuery = {
  aggregates: string[];
  columns: string[];
  conditions: string;
  name: string;
  orderby: string;
  // Table column alias.
  // We may want to have alias for y-axis in the future too
  fieldAliases?: string[];
  // Fields is replaced with aggregates + columns. It
  // is currently used to track column order on table
  // widgets.
  fields?: string[];
};

export type Widget = {
  displayType: DisplayType;
  interval: string;
  queries: WidgetQuery[];
  title: string;
  description?: string;
  id?: string;
  layout?: WidgetLayout | null;
  // Used to define 'topEvents' when fetching time-series data for a widget
  limit?: number;
  tempId?: string;
  thresholds?: ThresholdsConfig | null;
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

export enum DashboardFilterKeys {
  RELEASE = 'release',
}

export type DashboardFilters = {
  [DashboardFilterKeys.RELEASE]?: string[];
};

/**
 * Saved dashboard with widgets
 */
export type DashboardDetails = {
  dateCreated: string;
  filters: DashboardFilters;
  id: string;
  projects: undefined | number[];
  title: string;
  widgets: Widget[];
  createdBy?: User;
  end?: string;
  environment?: string[];
  period?: string;
  start?: string;
  utc?: boolean;
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
  DDM = 'ddm',
}
