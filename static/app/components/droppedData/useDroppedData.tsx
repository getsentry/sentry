import {useState} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {DroppedDataDrawer} from 'sentry/components/droppedData/droppedDataDrawer';
import {useFetchDroppedDataAnnotations} from 'sentry/components/droppedData/useFetchDroppedDataAnnotations';
import {useHasDroppedDataAnnotations} from 'sentry/components/droppedData/useHasDroppedDataAnnotations';
import type {DroppedData} from 'sentry/components/droppedData/utils';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';

interface UseDroppedDataOptions {
  dataset: DiscoverDatasets;
  interval: string;
}

/**
 * Fetch dropped/accepted data-fidelity annotations for a chart and wire up the
 * band + details drawer.
 *
 * Annotations come from the dedicated `/events-annotations/` endpoint (via
 * {@link useFetchDroppedDataAnnotations}), not the chart's timeseries `meta`, so
 * they no longer depend on the chart query requesting them.
 */
export function useDroppedData({dataset, interval}: UseDroppedDataOptions) {
  const hasAnnotations = useHasDroppedDataAnnotations();
  const {openDrawer} = useDrawer();
  const [showDroppedData, setShowDroppedData] = useState(true);

  const {data} = useFetchDroppedDataAnnotations({
    dataset,
    interval,
    enabled: hasAnnotations,
  });

  const droppedDataAnnotations = hasAnnotations ? data?.droppedAnnotations : undefined;
  const acceptedDataAnnotations = hasAnnotations ? data?.acceptedAnnotations : undefined;
  const hasDroppedData =
    defined(droppedDataAnnotations) && droppedDataAnnotations.length > 0;

  const chartProps: DroppedData = {
    dropped: droppedDataAnnotations,
    accepted: acceptedDataAnnotations,
    visible: showDroppedData,
    onClick: () => {
      if (!hasDroppedData) {
        return;
      }
      openDrawer(
        () => (
          <DroppedDataDrawer
            droppedDataAnnotations={droppedDataAnnotations}
            acceptedDataAnnotations={acceptedDataAnnotations ?? []}
          />
        ),
        {
          ariaLabel: t('Dropped Data'),
        }
      );
    },
  };

  return {
    chartProps,
    hasDroppedData,
    showDroppedData,
    setShowDroppedData,
  };
}
