import {useCallback, useEffect, useRef} from 'react';
import {parseAsBoolean, useQueryState} from 'nuqs';

import {useDrawer} from '@sentry/scraps/drawer';

import {DroppedDataDrawer} from 'sentry/components/droppedData/drawer/droppedDataDrawer';
import type {ReasonRow} from 'sentry/components/droppedData/drawer/outcomeSections';
import {buildTroubleshootPrompt} from 'sentry/components/droppedData/outcomes';
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

  const {openSeerExplorer} = useSeerExplorerContext();
  const openSeerExplorerRef = useRef(openSeerExplorer);
  useEffect(() => {
    openSeerExplorerRef.current = openSeerExplorer;
  });
  const handleTroubleshoot = useCallback(
    (row: ReasonRow) => {
      openSeerExplorerRef.current({
        initialQuery: buildTroubleshootPrompt({
          dataset,
          outcome: row.outcome,
          reason: row.reason,
        }),
      });
    },
    [dataset]
  );
  const onTroubleshoot = isSeerExplorerEnabled(organization)
    ? handleTroubleshoot
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
          onTroubleshoot={onTroubleshoot}
        />
      ),
      {
        ariaLabel: t('Dropped Events'),
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
    onTroubleshoot,
    pathname,
    setIsDrawerInUrl,
  ]);

  return useCallback(() => {
    void setIsDrawerInUrl(true, {history: 'push'});
  }, [setIsDrawerInUrl]);
}
