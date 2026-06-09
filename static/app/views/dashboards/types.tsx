import {t} from 'sentry/locale';
import type {Tag} from 'sentry/types/group';
import type {User} from 'sentry/types/user';
import {SavedQueryDatasets, type DatasetSource} from 'sentry/utils/discover/typesBase';
import {
  DashboardFilterKeys,
  DisplayType,
  SlideoutId,
  WidgetType,
} from 'sentry/views/dashboards/typesBase';
import type {
  DashboardPermissions,
  LegendType,
  WidgetChangedReason,
  WidgetLayout,
  WidgetPreview,
  WidgetQueryOnDemand,
} from 'sentry/views/dashboards/typesBase';
import type {AxisRange} from 'sentry/views/dashboards/utils/axisRange';
import type {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import type {TimeSeriesMeta} from 'sentry/views/dashboards/widgets/common/types';

import type {ThresholdsConfig} from './widgetBuilder/buildSteps/thresholdsStep/thresholds';

// Max widgets per dashboard we are currently willing
// to allow to limit the load on snuba from the
// parallel requests. Somewhat arbitrary
// limit that can be changed if necessary.
export const MAX_WIDGETS = 30;

export const DEFAULT_TABLE_LIMIT = 5;
export const MAX_TABLE_LIMIT = 10;

export const DEFAULT_CATEGORICAL_BAR_LIMIT = 20;
export const MAX_CATEGORICAL_BAR_LIMIT = 25;

export const DEFAULT_WIDGET_NAME = t('Custom Widget');
export const PREBUILT_DASHBOARD_LABEL = t('Sentry Built');

export const WIDGET_TYPE_TO_SAVED_QUERY_DATASET = {
  [WidgetType.ERRORS]: SavedQueryDatasets.ERRORS,
  [WidgetType.TRANSACTIONS]: SavedQueryDatasets.TRANSACTIONS,
};

export type LinkedDashboard = {
  // The destination dashboard id, set this to '-1' for prebuilt dashboards that link to other prebuilt dashboards
  dashboardId: string;
  field: string;
  // List of additional datasets to apply new dashboard filters to.
  // Typically we only apply filters to the same dataset as the widget, but this allows us to apply to other datasets when needed.
  additionalGlobalFilterDatasetTargets?: WidgetType[];
  // Used for static dashboards that are not saved to the database
  staticDashboardId?: PrebuiltDashboardId;
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
  // Used to define the units of the fields in the widget queries, currently not saved
  fieldMeta?: Array<Pick<TimeSeriesMeta, 'valueType' | 'valueUnit'> | null>;
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
};

export type Widget = {
  displayType: DisplayType;
  interval: string;
  queries: WidgetQuery[];
  title: string;
  axisRange?: AxisRange;
  changedReason?: WidgetChangedReason[];
  dashboardId?: string;
  datasetSource?: DatasetSource;
  description?: string;
  exploreUrls?: null | string[];
  id?: string;
  layout?: WidgetLayout | null;
  legendType?: LegendType | null;
  // Used to define 'topEvents' when fetching time-series data for a widget
  limit?: number | null;
  // Used for table widget column widths, currently is not saved
  tableWidths?: number[];
  tempId?: string;
  thresholds?: ThresholdsConfig | null;
  widgetType?: WidgetType;
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
