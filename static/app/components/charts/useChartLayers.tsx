import {
  DROPPED_DATA_LAYER,
  useDroppedDataLayer,
} from 'sentry/components/droppedData/useDroppedDataLayer';
import type {DroppedDataAnalyticsSource} from 'sentry/utils/analytics/exploreAnalyticsEvents';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';

import type {ChartLayersControlProps} from './chartLayersControl';

interface UseChartLayersParams {
  dataset: DiscoverDatasets;
  interval: string;
  source: DroppedDataAnalyticsSource;
  enabled?: boolean;
  hidden?: boolean;
}

/**
 * The context layers drawn on a time series chart, and the single Layers
 * control that toggles them.
 */
export function useChartLayers({
  dataset,
  interval,
  source,
  enabled = true,
  hidden = false,
}: UseChartLayersParams) {
  const droppedData = useDroppedDataLayer({dataset, interval}, {source, enabled, hidden});

  const layers = droppedData.layerControl?.layers ?? [];

  function onLayerChange(value: string, selected: boolean) {
    if (value === DROPPED_DATA_LAYER) {
      droppedData.layerControl?.onChange(value, selected);
    }
  }

  const layerControl: ChartLayersControlProps | undefined =
    layers.length > 0 ? {layers, onChange: onLayerChange} : undefined;

  return {droppedData, layerControl};
}
