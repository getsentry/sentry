import {useCallback, useState} from 'react';

import type {ChartLayersControlProps} from 'sentry/components/charts/chartLayersControl';
import type {ChartContextTab} from 'sentry/components/charts/contextDrawer/chartContextDrawer';
import {useChartContextDrawer} from 'sentry/components/charts/contextDrawer/useChartContextDrawer';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {DroppedDataAnalyticsSource} from 'sentry/utils/analytics/exploreAnalyticsEvents';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';

import {hasDroppedData} from './buckets';
import type {DroppedDataFilterNoteProps} from './droppedDataFilterNote';
import {datasetNoun, droppedDataLabel} from './outcomes';
import type {DroppedDataProps} from './types';
import {useDroppedData, type UseDroppedDataParams} from './useDroppedData';

export const DROPPED_DATA_LAYER = 'dropped-data';

const SUPPORTED_DATASETS = new Set<DiscoverDatasets>([
  DiscoverDatasets.ERRORS,
  DiscoverDatasets.OURLOGS,
  DiscoverDatasets.SPANS,
  DiscoverDatasets.TRACEMETRICS,
]);

interface UseDroppedDataLayerParams extends UseDroppedDataParams {
  environments?: string[];
}

interface UseDroppedDataLayerOptions {
  source: DroppedDataAnalyticsSource;
  enabled?: boolean;
  hidden?: boolean;
  showAnnotationTabs?: boolean;
}

interface DroppedDataLayer {
  band: DroppedDataProps | undefined;
  filterNote: Pick<DroppedDataFilterNoteProps, 'dataset' | 'environments'> | undefined;
  isLoading: boolean;
  layerControl: ChartLayersControlProps | undefined;
  openContextDrawer: (tab?: ChartContextTab) => void;
}

/**
 * Everything a chart needs to show the dropped data band, its layer control,
 * and its filter note.
 */
export function useDroppedDataLayer(
  {environments, ...params}: UseDroppedDataLayerParams,
  {
    source,
    enabled = true,
    hidden = false,
    showAnnotationTabs = false,
  }: UseDroppedDataLayerOptions
): DroppedDataLayer {
  const organization = useOrganization();
  const {dataset} = params;
  const isEnabled = enabled && SUPPORTED_DATASETS.has(dataset);
  const {droppedEvents, acceptedEvents, isLoading} = useDroppedData(params, {
    enabled: isEnabled,
  });
  const [isLayerOn, setIsLayerOn] = useState(true);
  const openContextDrawer = useChartContextDrawer(params, {
    source,
    enabled: isEnabled,
    showAnnotationTabs,
  });
  const openDroppedDataTab = useCallback(() => openContextDrawer(), [openContextDrawer]);

  const isLoaded = isEnabled && defined(droppedEvents);
  const canShowDroppedData = isEnabled && hasDroppedData(droppedEvents, acceptedEvents);
  const isBandShown = canShowDroppedData && isLayerOn && !hidden;

  return {
    band: isBandShown
      ? {dataset, droppedEvents, acceptedEvents, onClick: openDroppedDataTab}
      : undefined,
    openContextDrawer,
    filterNote: isBandShown ? {dataset, environments} : undefined,
    isLoading: isEnabled && isLayerOn && !hidden && isLoading,
    layerControl: isLoaded
      ? {
          layers: [
            {
              value: DROPPED_DATA_LAYER,
              label: droppedDataLabel(dataset),
              selected: canShowDroppedData && isLayerOn,
              disabled: !canShowDroppedData,
              tooltip: canShowDroppedData
                ? undefined
                : t(
                    'No significant dropped %s in this time range',
                    datasetNoun(dataset, 2)
                  ),
            },
          ],
          onChange: (_value, selected) => {
            setIsLayerOn(selected);
            trackAnalytics('explore.dropped_data.layer_toggled', {
              organization,
              dataset,
              source,
              selected,
            });
          },
        }
      : undefined,
  };
}
