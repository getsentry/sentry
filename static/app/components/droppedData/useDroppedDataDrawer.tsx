import {useCallback, useEffect, useRef} from 'react';
import {parseAsBoolean, useQueryState} from 'nuqs';

import {useDrawer} from '@sentry/scraps/drawer';

import {DroppedDataDrawer} from 'sentry/components/droppedData/droppedDataDrawer';
import {t} from 'sentry/locale';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

const DROPPED_DATA_DRAWER_QUERY_KEY = 'droppedData';

export function useDroppedDataDrawer(dataset: DiscoverDatasets, interval?: string) {
  const {openDrawer, isDrawerOpen, isAnyDrawerOpen} = useDrawer();
  const {pathname} = useLocation();
  const [isDrawerInUrl, setIsDrawerInUrl] = useQueryState(
    DROPPED_DATA_DRAWER_QUERY_KEY,
    parseAsBoolean.withDefault(false)
  );
  const renderedIntervalRef = useRef(interval);

  useEffect(() => {
    if (!isDrawerInUrl) {
      return;
    }
    const isStale = isDrawerOpen && renderedIntervalRef.current !== interval;
    if (isAnyDrawerOpen && !isStale) {
      return;
    }
    renderedIntervalRef.current = interval;
    openDrawer(() => <DroppedDataDrawer dataset={dataset} interval={interval} />, {
      ariaLabel: t('Dropped Data'),
      shouldCloseOnLocationChange: nextLocation =>
        nextLocation.pathname !== pathname ||
        decodeScalar(nextLocation.query[DROPPED_DATA_DRAWER_QUERY_KEY]) !== 'true',
      onClose: () => {
        void setIsDrawerInUrl(null, {history: 'replace'});
      },
    });
  }, [
    isDrawerInUrl,
    isDrawerOpen,
    isAnyDrawerOpen,
    openDrawer,
    dataset,
    interval,
    pathname,
    setIsDrawerInUrl,
  ]);

  return useCallback(() => {
    void setIsDrawerInUrl(true, {history: 'push'});
  }, [setIsDrawerInUrl]);
}
