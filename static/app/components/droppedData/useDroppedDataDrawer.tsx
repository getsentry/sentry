import {useCallback, useEffect} from 'react';
import {parseAsBoolean, useQueryState} from 'nuqs';

import {useDrawer} from '@sentry/scraps/drawer';

import {DroppedDataDrawer} from 'sentry/components/droppedData/droppedDataDrawer';
import {t} from 'sentry/locale';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

const DROPPED_DATA_DRAWER_QUERY_KEY = 'droppedData';

export function useDroppedDataDrawer(dataset: DiscoverDatasets) {
  const {openDrawer, isAnyDrawerOpen} = useDrawer();
  const {pathname} = useLocation();
  const [isDrawerInUrl, setIsDrawerInUrl] = useQueryState(
    DROPPED_DATA_DRAWER_QUERY_KEY,
    parseAsBoolean.withDefault(false)
  );

  useEffect(() => {
    if (!isDrawerInUrl || isAnyDrawerOpen) {
      return;
    }
    openDrawer(() => <DroppedDataDrawer dataset={dataset} />, {
      ariaLabel: t('Dropped Data'),
      shouldCloseOnLocationChange: nextLocation =>
        nextLocation.pathname !== pathname ||
        decodeScalar(nextLocation.query[DROPPED_DATA_DRAWER_QUERY_KEY]) !== 'true',
      onClose: () => {
        void setIsDrawerInUrl(null, {history: 'replace'});
      },
    });
  }, [isDrawerInUrl, isAnyDrawerOpen, openDrawer, dataset, pathname, setIsDrawerInUrl]);

  return useCallback(() => {
    void setIsDrawerInUrl(true, {history: 'push'});
  }, [setIsDrawerInUrl]);
}
