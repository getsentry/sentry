import {useCallback, useState} from 'react';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {DroppedDataAnalyticsSource} from 'sentry/utils/analytics/exploreAnalyticsEvents';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {ChartLayersControlProps} from './chartLayersControl';

export const CONFIDENCE_LAYER = 'confidence';

interface UseConfidenceLayerOptions {
  source: DroppedDataAnalyticsSource;
  enabled?: boolean;
}

/**
 * The Layers control entry that shows or hides low-confidence markers on a
 * time series chart. Pass `showConfidence` to `TimeSeriesWidgetVisualization`.
 */
export function useConfidenceLayer({source, enabled = true}: UseConfidenceLayerOptions) {
  const organization = useOrganization();
  const [isLayerOn, setIsLayerOn] = useState(true);
  const isEnabled =
    enabled && organization.features.includes('data-browsing-time-series-confidence');

  const onChange = useCallback(
    (_value: string, selected: boolean) => {
      setIsLayerOn(selected);
      trackAnalytics('explore.confidence.layer_toggled', {
        organization,
        source,
        selected,
      });
    },
    [organization, source]
  );

  const layerControl: ChartLayersControlProps | undefined = isEnabled
    ? {
        layers: [{value: CONFIDENCE_LAYER, label: t('Confidence'), selected: isLayerOn}],
        onChange,
      }
    : undefined;

  return {showConfidence: isLayerOn, layerControl};
}
