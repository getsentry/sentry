import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {trackAnalytics} from 'sentry/utils/analytics';
import {DatasetSource} from 'sentry/utils/discover/typesBase';
import {useOrganization} from 'sentry/utils/useOrganization';
import {type Widget} from 'sentry/views/dashboards/types';
import {WidgetType} from 'sentry/views/dashboards/typesBase';

interface UseTrackAnalyticsOnErrorProps {
  loading: boolean;
  widget: Widget;
  errorMessage?: string;
}

const {info, fmt} = Sentry.logger;

export function useTrackAnalyticsOnSpanMigrationError({
  errorMessage,
  widget,
  loading,
}: UseTrackAnalyticsOnErrorProps) {
  const organization = useOrganization();
  useEffect(() => {
    if (
      !(
        (widget.datasetSource === DatasetSource.SPAN_MIGRATION ||
          widget.datasetSource === DatasetSource.SPAN_MIGRATION_V2) &&
        widget.widgetType === WidgetType.SPANS
      )
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

    info(
      fmt`dashboards2.span_migration.results_check:
      organization: ${organization.slug}
      widgetId: ${widget.id},
      dashboardId: ${widget.dashboardId},
      errorMessage: ${errorMessage},
    `
    );

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
