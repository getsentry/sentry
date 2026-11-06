import {useState} from 'react';

import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

import {
  useDroppedDataDrawer,
  type UseDroppedDataDrawerParams,
} from './drawer/useDroppedDataDrawer';
import {hasDroppedData} from './buckets';
import type {DroppedDataFilterNoteProps} from './droppedDataFilterNote';
import type {DroppedDataLayerControlProps} from './droppedDataLayerControl';
import type {DroppedDataProps} from './types';
import {useDroppedData} from './useDroppedData';

const SUPPORTED_DATASETS = new Set<DiscoverDatasets>([
  DiscoverDatasets.ERRORS,
  DiscoverDatasets.OURLOGS,
  DiscoverDatasets.SPANS,
  DiscoverDatasets.TRACEMETRICS,
]);

interface UseDroppedDataLayerParams extends UseDroppedDataDrawerParams {
  environments?: string[];
}

interface UseDroppedDataLayerOptions {
  enabled?: boolean;
  hidden?: boolean;
}

interface DroppedDataLayer {
  band: DroppedDataProps | undefined;
  filterNote: Pick<DroppedDataFilterNoteProps, 'dataset' | 'environments'> | undefined;
  layerControl: DroppedDataLayerControlProps | undefined;
}

/**
 * Everything a chart needs to show the dropped data band, its layer control,
 * and its filter note.
 */
export function useDroppedDataLayer(
  {environments, surface, ...params}: UseDroppedDataLayerParams,
  {enabled = true, hidden = false}: UseDroppedDataLayerOptions = {}
): DroppedDataLayer {
  const {dataset} = params;
  const isEnabled = enabled && SUPPORTED_DATASETS.has(dataset);
  const {droppedEvents, acceptedEvents} = useDroppedData(params, {enabled: isEnabled});
  const [isLayerOn, setIsLayerOn] = useState(true);
  const openDroppedDataDrawer = useDroppedDataDrawer(
    {...params, surface},
    {enabled: isEnabled}
  );

  const isLoaded = isEnabled && defined(droppedEvents);
  const canShowDroppedData = isEnabled && hasDroppedData(droppedEvents, acceptedEvents);
  const isBandShown = canShowDroppedData && isLayerOn && !hidden;

  return {
    band: isBandShown
      ? {dataset, droppedEvents, acceptedEvents, onClick: openDroppedDataDrawer}
      : undefined,
    filterNote: isBandShown ? {dataset, environments} : undefined,
    layerControl: isLoaded
      ? {
          dataset,
          hasDroppedData: canShowDroppedData,
          showDroppedData: isLayerOn,
          onChange: setIsLayerOn,
        }
      : undefined,
  };
}
