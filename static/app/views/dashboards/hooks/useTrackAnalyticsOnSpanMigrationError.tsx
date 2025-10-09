import {useEffect} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import {DatasetSource} from 'sentry/utils/discover/types';
import useOrganization from 'sentry/utils/useOrganization';
import {WidgetType, type Widget} from 'sentry/views/dashboards/types';

interface UseTrackAnalyticsOnErrorProps {
  loading: boolean;
  widget: Widget;
  errorMessage?: string;
}

export function useTrackAnalyticsOnSpanMigrationError({
  errorMessage,
  widget,
  loading,
}: UseTrackAnalyticsOnErrorProps) {
  const organization = useOrganization();
  useEffect(() => {
    if (
      widget.datasetSource !== DatasetSource.SPAN_MIGRATION ||
      widget.widgetType !== WidgetType.SPANS
    ) {
      return;
    }

    if (loading) {
      return;
    }

    if (!errorMessage) {
      return;
    }

    trackAnalytics('dashboards2.span_migration.results_check', {
      organization,
      widget_id: widget.id,
      dashboard_id: widget.dashboardId,
      error_message: errorMessage,
    });
    return;
  }, [
    errorMessage,
    loading,
    organization,
    widget.dashboardId,
    widget.datasetSource,
    widget.id,
    widget.widgetType,
  ]);
}
