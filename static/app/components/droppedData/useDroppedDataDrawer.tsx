import {useCallback, useEffect, useRef} from 'react';
import {parseAsBoolean, useQueryState} from 'nuqs';

import {useDrawer} from '@sentry/scraps/drawer';

import {DroppedDataDrawer} from 'sentry/components/droppedData/droppedDataDrawer';
import {t} from 'sentry/locale';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {isSeerExplorerEnabled} from 'sentry/utils/seer/isSeerExplorerEnabled';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

const DROPPED_DATA_DRAWER_QUERY_KEY = 'droppedData';

interface UseDroppedDataDrawerParams {
  dataset: DiscoverDatasets;
  interval?: string;
}

interface UseDroppedDataDrawerOptions {
  enabled?: boolean;
}

export function useDroppedDataDrawer(
  {dataset, interval}: UseDroppedDataDrawerParams,
  {enabled = true}: UseDroppedDataDrawerOptions = {}
) {
  const organization = useOrganization();
  const {openDrawer, isDrawerOpen, isAnyDrawerOpen} = useDrawer();
  const {pathname} = useLocation();
  const [isDrawerInUrl, setIsDrawerInUrl] = useQueryState(
    DROPPED_DATA_DRAWER_QUERY_KEY,
    parseAsBoolean.withDefault(false)
  );
  const renderedIntervalRef = useRef(interval);

  // TODO: switch this to openChatPrompt, as well as handleInvestigate,
  // to supply prompt context.
  const {openSeerExplorer} = useSeerExplorerContext();
  const openSeerExplorerRef = useRef(openSeerExplorer);
  useEffect(() => {
    openSeerExplorerRef.current = openSeerExplorer;
  });
  const handleInvestigate = useCallback(() => openSeerExplorerRef.current(), []);
  const onInvestigate = isSeerExplorerEnabled(organization)
    ? handleInvestigate
    : undefined;

  useEffect(() => {
    if (!enabled || !isDrawerInUrl) {
      return;
    }
    const isStale = isDrawerOpen && renderedIntervalRef.current !== interval;
    if (isAnyDrawerOpen && !isStale) {
      return;
    }
    renderedIntervalRef.current = interval;
    openDrawer(
      () => (
        <DroppedDataDrawer
          dataset={dataset}
          interval={interval}
          onInvestigate={onInvestigate}
        />
      ),
      {
        ariaLabel: t('Dropped Data'),
        shouldCloseOnLocationChange: nextLocation =>
          nextLocation.pathname !== pathname ||
          decodeScalar(nextLocation.query[DROPPED_DATA_DRAWER_QUERY_KEY]) !== 'true',
        onClose: () => {
          void setIsDrawerInUrl(null, {history: 'replace'});
        },
      }
    );
  }, [
    enabled,
    isDrawerInUrl,
    isDrawerOpen,
    isAnyDrawerOpen,
    openDrawer,
    dataset,
    interval,
    onInvestigate,
    pathname,
    setIsDrawerInUrl,
  ]);

  return useCallback(() => {
    void setIsDrawerInUrl(true, {history: 'push'});
  }, [setIsDrawerInUrl]);
}
