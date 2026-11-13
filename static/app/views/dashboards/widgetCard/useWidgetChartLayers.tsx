import {useState} from 'react';

import type {
  ChartLayer,
  ChartLayersControlProps,
} from 'sentry/components/charts/chartLayersControl';
import {useDroppedDataLayer} from 'sentry/components/droppedData/useDroppedDataLayer';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetType, type Widget} from 'sentry/views/dashboards/types';

const RELEASES_LAYER = 'releases';

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
  const [isReleasesLayerOn, setIsReleasesLayerOn] = useState(true);

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

  const supportsReleases = widget.widgetType !== WidgetType.PREPROD_APP_SIZE;
  const droppedDataLayerControl = hidden ? undefined : droppedData.layerControl;
  const layers: ChartLayer[] = enabled
    ? [
        ...(supportsReleases
          ? [{value: RELEASES_LAYER, label: t('Releases'), selected: isReleasesLayerOn}]
          : []),
        ...(droppedDataLayerControl?.layers ?? []),
      ]
    : [];

  const layerControl: ChartLayersControlProps | undefined =
    layers.length > 0
      ? {
          layers,
          onChange: (value, selected) => {
            if (value === RELEASES_LAYER) {
              setIsReleasesLayerOn(selected);
            } else {
              droppedDataLayerControl?.onChange(value, selected);
            }
          },
        }
      : undefined;

  return {
    showReleases: supportsReleases && isReleasesLayerOn,
    droppedData,
    layerControl,
  };
}
