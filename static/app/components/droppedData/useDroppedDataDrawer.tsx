import {useDrawer} from '@sentry/scraps/drawer';

import {DroppedDataDrawer} from 'sentry/components/droppedData/droppedDataDrawer';
import {t} from 'sentry/locale';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';

export function useDroppedDataDrawer(dataset: DiscoverDatasets) {
  const {openDrawer} = useDrawer();
  const {pathname} = useLocation();

  return () => {
    openDrawer(() => <DroppedDataDrawer dataset={dataset} />, {
      ariaLabel: t('Dropped Data'),
      shouldCloseOnLocationChange: nextLocation => nextLocation.pathname !== pathname,
    });
  };
}
