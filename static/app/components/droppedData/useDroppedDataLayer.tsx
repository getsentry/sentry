import {useState} from 'react';

import {hasDroppedData} from 'sentry/components/droppedData/buckets';
import {useDroppedDataDrawer} from 'sentry/components/droppedData/drawer/useDroppedDataDrawer';
import type {DroppedDataFilterNoteProps} from 'sentry/components/droppedData/droppedDataFilterNote';
import type {DroppedDataLayerControlProps} from 'sentry/components/droppedData/droppedDataLayerControl';
import type {DroppedDataProps} from 'sentry/components/droppedData/types';
import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

const SUPPORTED_DATASETS = new Set<DiscoverDatasets>([
  DiscoverDatasets.ERRORS,
  DiscoverDatasets.OURLOGS,
  DiscoverDatasets.SPANS,
  DiscoverDatasets.TRACEMETRICS,
]);

interface UseDroppedDataLayerParams {
  dataset: DiscoverDatasets;
  interval: string;
}

interface UseDroppedDataLayerOptions {
  enabled?: boolean;
  hidden?: boolean;
}

interface DroppedDataLayer {
  band: DroppedDataProps | undefined;
  filterNote: Pick<DroppedDataFilterNoteProps, 'dataset'> | undefined;
  layerControl: DroppedDataLayerControlProps | undefined;
}

/**
 * Everything a chart needs to show the dropped data band, its layer control,
 * and its filter note.
 */
export function useDroppedDataLayer(
  {dataset, interval}: UseDroppedDataLayerParams,
  {enabled = true, hidden = false}: UseDroppedDataLayerOptions = {}
): DroppedDataLayer {
  const isEnabled = enabled && SUPPORTED_DATASETS.has(dataset);
  const {droppedEvents, acceptedEvents} = useDroppedData(
    {dataset, interval},
    {enabled: isEnabled}
  );
  const [isLayerOn, setIsLayerOn] = useState(true);
  const openDroppedDataDrawer = useDroppedDataDrawer(
    {dataset, interval},
    {enabled: isEnabled}
  );

  const isLoaded = isEnabled && defined(droppedEvents);
  const canShowDroppedData = isEnabled && hasDroppedData(droppedEvents, acceptedEvents);
  const isBandShown = canShowDroppedData && isLayerOn && !hidden;

  return {
    band: isBandShown
      ? {dataset, droppedEvents, acceptedEvents, onClick: openDroppedDataDrawer}
      : undefined,
    filterNote: isBandShown ? {dataset} : undefined,
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
