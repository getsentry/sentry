import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetType, type Widget} from 'sentry/views/dashboards/types';

export function trackEngagementAnalytics(
  widgets: Widget[],
  organization: Organization,
  dashboardTitle: string
) {
  // Handle edge-case of dashboard with no widgets.
  if (!widgets.length) return;

  // For attributing engagement metrics initially track the ratio
  // of widgets reading from Transactions, Spans, Errors, and Issues, and Logs.
  const issuesWidgetTypes = new Set<string | undefined>([
    WidgetType.ERRORS,
    WidgetType.ISSUE,
    WidgetType.RELEASE,
  ]);
  const logWidgetTypes = new Set<string | undefined>([WidgetType.LOGS]);
  const tracingWidgetTypes = new Set<string | undefined>([
    WidgetType.TRANSACTIONS,
    WidgetType.SPANS,
  ]);
  let issuesWidgetCount = 0.0;
  let logWidgetCount = 0.0;
  let tracingWidgetCount = 0.0;
  for (const widget of widgets) {
    if (issuesWidgetTypes.has(widget.widgetType)) {
      issuesWidgetCount += 1.0;
    } else if (logWidgetTypes.has(widget.widgetType)) {
      logWidgetCount += 1.0;
    } else if (tracingWidgetTypes.has(widget.widgetType)) {
      tracingWidgetCount += 1.0;
    }
  }
  const analyticsPayload = {
    organization,
    title: dashboardTitle,
    tracingRatio: tracingWidgetCount / widgets.length,
    issuesRatio: issuesWidgetCount / widgets.length,
    logRatio: logWidgetCount / widgets.length,
  };
  trackAnalytics('dashboards_views.engagement.load', analyticsPayload);
}
