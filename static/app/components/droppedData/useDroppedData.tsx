import {useState} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {DroppedDataDrawer} from 'sentry/components/droppedData/droppedDataDrawer';
import {useHasDroppedDataAnnotations} from 'sentry/components/droppedData/useHasDroppedDataAnnotations';
import type {DroppedData} from 'sentry/components/droppedData/utils';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

export function useDroppedData(meta: EventsTimeSeriesResponse['meta']) {
  const hasAnnotations = useHasDroppedDataAnnotations();
  const {openDrawer} = useDrawer();
  const [showDroppedData, setShowDroppedData] = useState(true);

  const droppedDataAnnotations = hasAnnotations ? meta?.droppedAnnotations : undefined;
  const acceptedDataAnnotations = hasAnnotations ? meta?.acceptedAnnotations : undefined;
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
