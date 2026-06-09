import type {Layout} from 'react-grid-layout';

export enum DashboardFilter {
  ONLY_FAVORITES = 'onlyFavorites',
  EXCLUDE_FAVORITES = 'excludeFavorites',
  OWNED = 'owned',
  SHARED = 'shared',
  EXCLUDE_PREBUILT = 'excludePrebuilt',
  ONLY_PREBUILT = 'onlyPrebuilt',
  ALL = 'all',
  SHOW_HIDDEN = 'showHidden',
}
export type LegendType = 'default' | 'breakdown';
export enum DisplayType {
  AREA = 'area',
  BAR = 'bar',
  LINE = 'line',
  TABLE = 'table',
  BIG_NUMBER = 'big_number',
  DETAILS = 'details',
  SERVER_TREE = 'server_tree',
  RAGE_AND_DEAD_CLICKS = 'rage_and_dead_clicks',
  TOP_N = 'top_n',
  WHEEL = 'wheel',
  CATEGORICAL_BAR = 'categorical_bar',
  AGENTS_TRACES_TABLE = 'agents_traces_table',
  TEXT = 'text',
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
  PREPROD_APP_SIZE = 'preprod-app-size',
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
export interface WidgetQueryOnDemand {
  enabled: boolean;
  extractionState: OnDemandExtractionState;
}
export type WidgetChangedReason = {
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
export enum DashboardFilterKeys {
  RELEASE = 'release',
  GLOBAL_FILTER = 'globalFilter',
}
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
