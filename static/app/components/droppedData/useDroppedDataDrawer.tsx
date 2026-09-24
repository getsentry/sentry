import {useCallback, useEffect, useEffectEvent} from 'react';

import type {DrawerConfig} from '@sentry/scraps/drawer';
import {useDrawer} from '@sentry/scraps/drawer';

import {DroppedDataDrawer} from 'sentry/components/droppedData/droppedDataDrawer';
import {hasDroppedData} from 'sentry/components/droppedData/utils';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {useLocation} from 'sentry/utils/useLocation';

export function useDroppedDataDrawer(
  droppedAnnotations: Annotation[] | undefined,
  acceptedAnnotations: Annotation[] | undefined
) {
  const {openDrawer, isDrawerOpen} = useDrawer();
  const {pathname} = useLocation();

  const openDroppedDataDrawer = useCallback(
    (dropped: Annotation[], accepted: Annotation[] = []) => {
      const drawerRenderer: DrawerConfig['renderer'] = () => (
        <DroppedDataDrawer droppedAnnotations={dropped} acceptedAnnotations={accepted} />
      );
      const drawerOptions: DrawerConfig['options'] = {
        ariaLabel: t('Dropped Data'),
        shouldCloseOnLocationChange: nextLocation => nextLocation.pathname !== pathname,
      };

      openDrawer(drawerRenderer, drawerOptions);
    },
    [openDrawer, pathname]
  );

  const refreshOpenDrawer = useEffectEvent(
    (dropped: Annotation[] | undefined, accepted: Annotation[] | undefined) => {
      if (isDrawerOpen && defined(dropped)) {
        openDroppedDataDrawer(dropped, accepted);
      }
    }
  );

  // Refresh drawer when annotations change.
  useEffect(() => {
    refreshOpenDrawer(droppedAnnotations, acceptedAnnotations);
  }, [droppedAnnotations, acceptedAnnotations]);

  return () => {
    if (!hasDroppedData(droppedAnnotations)) {
      return;
    }
    openDroppedDataDrawer(droppedAnnotations, acceptedAnnotations);
  };
}
