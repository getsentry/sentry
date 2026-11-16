import {useState} from 'react';

import type {ChartLayersControlProps} from 'sentry/components/charts/chartLayersControl';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

import {useDroppedDataDrawer} from './drawer/useDroppedDataDrawer';
import {hasDroppedData} from './buckets';
import type {DroppedDataFilterNoteProps} from './droppedDataFilterNote';
import {datasetNoun, droppedDataLabel} from './outcomes';
import type {DroppedDataProps} from './types';
import {useDroppedData, type UseDroppedDataParams} from './useDroppedData';

const DROPPED_DATA_LAYER = 'dropped-data';

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
  enabled?: boolean;
  hidden?: boolean;
}

interface DroppedDataLayer {
  band: DroppedDataProps | undefined;
  filterNote: Pick<DroppedDataFilterNoteProps, 'dataset' | 'environments'> | undefined;
  isLoading: boolean;
  layerControl: ChartLayersControlProps | undefined;
}

/**
 * Everything a chart needs to show the dropped data band, its layer control,
 * and its filter note.
 */
export function useDroppedDataLayer(
  {environments, ...params}: UseDroppedDataLayerParams,
  {enabled = true, hidden = false}: UseDroppedDataLayerOptions = {}
): DroppedDataLayer {
  const {dataset} = params;
  const isEnabled = enabled && SUPPORTED_DATASETS.has(dataset);
  const {droppedEvents, acceptedEvents, isLoading} = useDroppedData(params, {
    enabled: isEnabled,
  });
  const [isLayerOn, setIsLayerOn] = useState(true);
  const openDroppedDataDrawer = useDroppedDataDrawer(params, {enabled: isEnabled});

  const isLoaded = isEnabled && defined(droppedEvents);
  const canShowDroppedData = isEnabled && hasDroppedData(droppedEvents, acceptedEvents);
  const isBandShown = canShowDroppedData && isLayerOn && !hidden;

  return {
    band: isBandShown
      ? {dataset, droppedEvents, acceptedEvents, onClick: openDroppedDataDrawer}
      : undefined,
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
          onChange: (_value, selected) => setIsLayerOn(selected),
        }
      : undefined,
  };
}
