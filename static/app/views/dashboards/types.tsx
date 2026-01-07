import type {Layout} from 'react-grid-layout';

import {t} from 'sentry/locale';
import type {Tag} from 'sentry/types/group';
import type {User} from 'sentry/types/user';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import {SavedQueryDatasets, type DatasetSource} from 'sentry/utils/discover/types';
import type {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

import type {ThresholdsConfig} from './widgetBuilder/buildSteps/thresholdsStep/thresholds';

// Max widgets per dashboard we are currently willing
// to allow to limit the load on snuba from the
// parallel requests. Somewhat arbitrary
// limit that can be changed if necessary.
export const MAX_WIDGETS = 30;

export const DEFAULT_TABLE_LIMIT = 5;

export const DEFAULT_WIDGET_NAME = t('Custom Widget');

export enum DisplayType {
  AREA = 'area',
  BAR = 'bar',
  LINE = 'line',
  TABLE = 'table',
  BIG_NUMBER = 'big_number',
  DETAILS = 'details',
  TOP_N = 'top_n',
  WHEEL = 'wheel',
}

export enum WidgetType {
  DISCOVER = 'discover',
  ISSUE = 'issue',
  RELEASE = 'metrics', // TODO(metrics): rename RELEASE to 'release', and METRICS to 'metrics'
  METRICS = 'custom-metrics',
  ERRORS = 'error-events',
  TRANSACTIONS = 'transaction-like',
  SPANS = 'spans',
  LOGS = 'logs',
  TRACEMETRICS = 'tracemetrics',
}

// These only pertain to on-demand warnings at this point in time
// Since they are the only soft-validation we do.
type WidgetWarning = Record<string, OnDemandExtractionState>;
type WidgetQueryWarning = null | OnDemandExtractionState;

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

export type LinkedDashboard = {
  // The destination dashboard id, set this to '-1' for prebuilt dashboards that link to other prebuilt dashboards
  dashboardId: string;
  field: string;
  // Used for static dashboards that are not saved to the database
  staticDashboardId?: PrebuiltDashboardId;
};

type Unit = {
  valueType: AggregationOutputType;
  valueUnit: DataUnit;
};

/**
 * A widget query is one or more aggregates and a single filter string (conditions.)
 * Widgets can have multiple widget queries, and they all combine into a unified timeseries view (for example)
 */
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
  linkedDashboards?: LinkedDashboard[];
  // Contains the on-demand entries for the widget query.
  onDemand?: WidgetQueryOnDemand[];
  // Aggregate selected for the Big Number widget builder
  selectedAggregate?: number;
  // Links the widget query to a slide out panel if exists.
  // TODO: currently not stored in the backend, only used
  // by prebuilt dashboards in the frontend.
  slideOutId?: SlideoutId;
  // Used to define the units of the fields in the widget queries, currently not saved
  units?: Array<Unit | null>;
};

type WidgetChangedReason = {
  equations: Array<{
    equation: string;
    reason: string | string[];
  }> | null;
  orderby: Array<{
    orderby: string;
    reason: string | string[];
  }> | null;
  selected_columns: string[];
};

export type Widget = {
  displayType: DisplayType;
  interval: string;
  queries: WidgetQuery[];
  title: string;
  changedReason?: WidgetChangedReason[];
  dashboardId?: string;
  datasetSource?: DatasetSource;
  description?: string;
  exploreUrls?: null | string[];
  id?: string;
  layout?: WidgetLayout | null;
  // Used to define 'topEvents' when fetching time-series data for a widget
  limit?: number;
  // Used for table widget column widths, currently is not saved
  tableWidths?: number[];
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
  environment: string[];
  filters: DashboardFilters;
  id: string;
  projects: number[];
  title: string;
  widgetDisplay: DisplayType[];
  widgetPreview: WidgetPreview[];
  createdBy?: User;
  dateCreated?: string;
  isFavorited?: boolean;
  lastVisited?: string;
  permissions?: DashboardPermissions;
  prebuiltId?: PrebuiltDashboardId;
};

export enum DashboardFilterKeys {
  RELEASE = 'release',
  GLOBAL_FILTER = 'globalFilter',
}

export type DashboardFilters = {
  [DashboardFilterKeys.RELEASE]?: string[];
  [DashboardFilterKeys.GLOBAL_FILTER]?: GlobalFilter[];
};

export type GlobalFilter = {
  // Dataset the global filter will be applied to
  dataset: WidgetType;
  // The tag being filtered
  tag: Tag;
  // The raw filter condition string (e.g. 'tagKey:[values,...]')
  value: string;
  isTemporary?: boolean;
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
  prebuiltId?: PrebuiltDashboardId;
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
  EMBEDDED = 'embedded',
}

// where we launch the dashboard widget from
export enum DashboardWidgetSource {
  DISCOVERV2 = 'discoverv2',
  DASHBOARDS = 'dashboards',
  LIBRARY = 'library',
  ISSUE_DETAILS = 'issueDetail',
  TRACE_EXPLORER = 'traceExplorer',
  LOGS = 'logs',
  INSIGHTS = 'insights',
  TRACEMETRICS = 'traceMetrics',
}

export enum SlideoutId {
  LCP = 'lcp',
  FCP = 'fcp',
  INP = 'inp',
  CLS = 'cls',
  TTFB = 'ttfb',
  LCP_SUMMARY = 'lcp-summary',
  FCP_SUMMARY = 'fcp-summary',
  INP_SUMMARY = 'inp-summary',
  CLS_SUMMARY = 'cls-summary',
  TTFB_SUMMARY = 'ttfb-summary',
}
