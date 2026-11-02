import {useCallback, useEffect, useRef} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {buildAskSeerPrompt} from 'sentry/components/droppedData/drawer/askSeer';
import {DroppedDataDrawer} from 'sentry/components/droppedData/drawer/droppedDataDrawer';
import {droppedAndFilteredLabel} from 'sentry/components/droppedData/outcomes';
import type {ReasonRow} from 'sentry/components/droppedData/outcomeSections';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {isSeerExplorerEnabled} from 'sentry/utils/seer/isSeerExplorerEnabled';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
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
  const location = useLocation();
  const navigate = useNavigate();
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  });
  const {pathname} = location;
  // Use the router location rather than nuqs: GlobalDrawer closes from the
  // location, and nuqs applies browser back/forward a render later, so its stale
  // value would reopen the drawer.
  const isDrawerInUrl =
    decodeScalar(location.query[DROPPED_DATA_DRAWER_QUERY_KEY]) === 'true';
  const setIsDrawerInUrl = useCallback(
    (isOpen: boolean) => {
      navigate(
        {
          pathname: locationRef.current.pathname,
          query: {
            ...locationRef.current.query,
            [DROPPED_DATA_DRAWER_QUERY_KEY]: isOpen ? 'true' : undefined,
          },
        },
        // Closing replaces; a pushed entry would reopen the drawer on back.
        {replace: !isOpen, preventScrollReset: true}
      );
    },
    [navigate]
  );
  const renderedIntervalRef = useRef(interval);

  const {openSeerExplorer} = useSeerExplorerContext();
  const openSeerExplorerRef = useRef(openSeerExplorer);
  useEffect(() => {
    openSeerExplorerRef.current = openSeerExplorer;
  });
  const handleAskSeer = useCallback(
    (row: ReasonRow) => {
      trackAnalytics('explore.dropped_data.ask_seer_clicked', {
        organization,
        dataset,
        outcome: row.outcome,
        reason: row.reason,
      });
      openSeerExplorerRef.current({
        initialQuery: buildAskSeerPrompt({
          dataset,
          outcome: row.outcome,
          reason: row.reason,
        }),
      });
    },
    [dataset, organization]
  );
  const onAskSeer = isSeerExplorerEnabled(organization) ? handleAskSeer : undefined;

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
        <DroppedDataDrawer dataset={dataset} interval={interval} onAskSeer={onAskSeer} />
      ),
      {
        ariaLabel: droppedAndFilteredLabel(dataset),
        drawerKey: 'dropped-data-drawer',
        shouldCloseOnLocationChange: nextLocation =>
          nextLocation.pathname !== pathname ||
          decodeScalar(nextLocation.query[DROPPED_DATA_DRAWER_QUERY_KEY]) !== 'true',
        onClose: () => {
          setIsDrawerInUrl(false);
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
    onAskSeer,
    pathname,
    setIsDrawerInUrl,
  ]);

  return useCallback(() => {
    trackAnalytics('explore.dropped_data.drawer_opened', {organization, dataset});
    setIsDrawerInUrl(true);
  }, [organization, dataset, setIsDrawerInUrl]);
}
