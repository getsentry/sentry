import type {Layout} from 'react-grid-layout';

import type {User} from 'sentry/types/user';
import {type DatasetSource, SavedQueryDatasets} from 'sentry/utils/discover/types';

import type {ThresholdsConfig} from './widgetBuilder/buildSteps/thresholdsStep/thresholdsStep';

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
  RELEASE = 'metrics', // TODO(metrics): rename RELEASE to 'release', and METRICS to 'metrics'
  METRICS = 'custom-metrics',
  ERRORS = 'error-events',
  TRANSACTIONS = 'transaction-like',
  SPANS = 'spans',
}

// These only pertain to on-demand warnings at this point in time
// Since they are the only soft-validation we do.
export type WidgetWarning = Record<string, OnDemandExtractionState>;
export type WidgetQueryWarning = null | OnDemandExtractionState;

export interface ValidateWidgetResponse {
  warnings: {
    columns: WidgetWarning;
    queries: WidgetQueryWarning[]; // Ordered, matching queries passed via the widget.
  };
}

export enum OnDemandExtractionState {
  DISABLED_NOT_APPLICABLE = 'disabled:not-applicable',
  DISABLED_PREROLLOUT = 'disabled:pre-rollout',
  DISABLED_MANUAL = 'disabled:manual',
  DISABLED_SPEC_LIMIT = 'disabled:spec-limit',
  DISABLED_HIGH_CARDINALITY = 'disabled:high-cardinality',
  ENABLED_ENROLLED = 'enabled:enrolled',
  ENABLED_MANUAL = 'enabled:manual',
  ENABLED_CREATION = 'enabled:creation',
}

export const WIDGET_TYPE_TO_SAVED_QUERY_DATASET = {
  [WidgetType.ERRORS]: SavedQueryDatasets.ERRORS,
  [WidgetType.TRANSACTIONS]: SavedQueryDatasets.TRANSACTIONS,
};

interface WidgetQueryOnDemand {
  enabled: boolean;
  extractionState: OnDemandExtractionState;
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
  isHidden?: boolean | null;
  // Contains the on-demand entries for the widget query.
  onDemand?: WidgetQueryOnDemand[];
  // Aggregate selected for the Big Number widget builder
  selectedAggregate?: number;
};

export type Widget = {
  displayType: DisplayType;
  interval: string;
  queries: WidgetQuery[];
  title: string;
  dashboardId?: string;
  datasetSource?: DatasetSource;
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

export type DashboardPermissions = {
  isEditableByEveryone: boolean;
  teamsWithEditAccess?: number[];
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
  isFavorited?: boolean;
  permissions?: DashboardPermissions;
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
  isFavorited?: boolean;
  period?: string;
  permissions?: DashboardPermissions;
  start?: string;
  utc?: boolean;
};

export enum DashboardState {
  VIEW = 'view',
  EDIT = 'edit',
  INLINE_EDIT = 'inline_edit',
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
  TRACE_EXPLORER = 'traceExplorer',
}
