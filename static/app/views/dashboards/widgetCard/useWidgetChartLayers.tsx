import {useDroppedDataLayer} from 'sentry/components/droppedData/useDroppedDataLayer';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetType, type Widget} from 'sentry/views/dashboards/types';

// Only these widget datasets map to an Outcomes category on the backend
// (DATASET_TO_CATEGORY in data_annotations.py). Everything else gets no band.
const WIDGET_TYPE_TO_DROPPED_DATA_DATASET: Partial<Record<WidgetType, DiscoverDatasets>> =
  {
    [WidgetType.SPANS]: DiscoverDatasets.SPANS,
    [WidgetType.LOGS]: DiscoverDatasets.OURLOGS,
    [WidgetType.TRACEMETRICS]: DiscoverDatasets.TRACEMETRICS,
    [WidgetType.ERRORS]: DiscoverDatasets.ERRORS,
  };

interface UseWidgetChartLayersParams {
  widget: Widget;
  enabled?: boolean;
  hidden?: boolean;
  interval?: string;
}

export function useWidgetChartLayers({
  widget,
  interval,
  enabled = true,
  hidden = false,
}: UseWidgetChartLayersParams) {
  const organization = useOrganization();

  // The band reflects the page filters, not this widget's own projects/query, so
  // it won't follow a fullscreen zoom. Parameterize useDroppedData for per-widget
  // scope before GA.
  const droppedDataDataset = widget.widgetType
    ? WIDGET_TYPE_TO_DROPPED_DATA_DATASET[widget.widgetType]
    : undefined;
  const droppedData = useDroppedDataLayer(
    {
      dataset: droppedDataDataset ?? DiscoverDatasets.SPANS,
      interval: interval ?? '',
    },
    {
      enabled:
        enabled &&
        defined(droppedDataDataset) &&
        organization.features.includes('dashboards-data-fidelity-annotations'),
      hidden,
    }
  );

  return {
    showReleases: widget.widgetType !== WidgetType.PREPROD_APP_SIZE,
    droppedData,
  };
}
