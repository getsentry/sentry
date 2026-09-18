import {defined} from 'sentry/utils/defined';
import {downloadObjectAsJson} from 'sentry/utils/downloadObjectAsJson';

import type {DashboardDetails, DashboardFilters, Widget, WidgetQuery} from './types';

export const DASHBOARD_EXPORT_VERSION = 1;

type ExportedWidgetQuery = {
  aggregates: string[];
  columns: string[];
  conditions: string;
  name: string;
  orderby: string;
  fieldAliases?: string[];
  fields?: string[];
  isHidden?: boolean | null;
  selectedAggregate?: number;
};

type ExportedWidget = {
  displayType: Widget['displayType'];
  interval: string;
  queries: ExportedWidgetQuery[];
  title: string;
  axisRange?: Widget['axisRange'];
  description?: string;
  layout?: Widget['layout'];
  legendType?: Widget['legendType'];
  limit?: number | null;
  thresholds?: Widget['thresholds'];
  widgetType?: Widget['widgetType'];
};

type ExportedDashboard = {
  title: string;
  widgets: ExportedWidget[];
  environment?: string[];
  filters?: DashboardFilters;
  period?: string;
};

export type DashboardExportV1 = {
  dashboard: ExportedDashboard;
  version: typeof DASHBOARD_EXPORT_VERSION;
};

function stripQuery(query: WidgetQuery): ExportedWidgetQuery {
  return {
    name: query.name,
    conditions: query.conditions,
    aggregates: query.aggregates,
    columns: query.columns,
    orderby: query.orderby,
    ...(query.fields?.length ? {fields: query.fields} : {}),
    ...(query.fieldAliases?.length ? {fieldAliases: query.fieldAliases} : {}),
    ...(defined(query.isHidden) ? {isHidden: query.isHidden} : {}),
    ...(defined(query.selectedAggregate)
      ? {selectedAggregate: query.selectedAggregate}
      : {}),
  };
}

function stripWidget(widget: Widget): ExportedWidget {
  return {
    title: widget.title,
    displayType: widget.displayType,
    interval: widget.interval,
    queries: widget.queries.map(stripQuery),
    ...(widget.widgetType ? {widgetType: widget.widgetType} : {}),
    ...(widget.description ? {description: widget.description} : {}),
    ...(widget.layout ? {layout: widget.layout} : {}),
    ...(defined(widget.limit) ? {limit: widget.limit} : {}),
    ...(widget.thresholds ? {thresholds: widget.thresholds} : {}),
    ...(widget.legendType ? {legendType: widget.legendType} : {}),
    ...(widget.axisRange ? {axisRange: widget.axisRange} : {}),
  };
}

export function exportDashboard(dashboard: DashboardDetails) {
  const exported: DashboardExportV1 = {
    version: DASHBOARD_EXPORT_VERSION,
    dashboard: {
      title: dashboard.title,
      widgets: dashboard.widgets.map(stripWidget),
      ...(dashboard.filters && Object.keys(dashboard.filters).length > 0
        ? {filters: dashboard.filters}
        : {}),
      ...(dashboard.environment?.length ? {environment: dashboard.environment} : {}),
      ...(dashboard.period ? {period: dashboard.period} : {}),
    },
  };

  const slug = dashboard.title.replace(/[^a-z0-9]/gi, '-');
  downloadObjectAsJson(exported, `${slug}-${new Date().toISOString()}`);
}

export function parseDashboardExport(data: unknown): ExportedDashboard {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid export file: expected a JSON object');
  }

  const obj = data as Record<string, unknown>;

  if (!('version' in obj)) {
    if ('title' in obj && 'widgets' in obj) {
      return data as ExportedDashboard;
    }
    throw new Error('Invalid export file: missing version field');
  }

  if (obj.version !== DASHBOARD_EXPORT_VERSION) {
    throw new Error(
      `Unsupported export version: ${obj.version}. Expected version ${DASHBOARD_EXPORT_VERSION}.`
    );
  }

  if (!obj.dashboard || typeof obj.dashboard !== 'object') {
    throw new Error('Invalid export file: missing dashboard data');
  }

  const dashboard = obj.dashboard as Record<string, unknown>;
  if (!dashboard.title || !Array.isArray(dashboard.widgets)) {
    throw new Error('Invalid export file: dashboard must have a title and widgets');
  }

  return obj.dashboard as ExportedDashboard;
}
