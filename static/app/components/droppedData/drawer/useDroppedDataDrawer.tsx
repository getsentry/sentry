import {useCallback, useEffect, useRef} from 'react';
import isEqual from 'lodash/isEqual';
import {createLoader, parseAsString, useQueryStates} from 'nuqs';

import {useDrawer} from '@sentry/scraps/drawer';

import {droppedAndFilteredLabel} from 'sentry/components/droppedData/outcomes';
import type {ReasonRow} from 'sentry/components/droppedData/outcomeSections';
import type {UseDroppedDataParams} from 'sentry/components/droppedData/useDroppedData';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DiscoverDatasetToUrlParam} from 'sentry/utils/discover/types';
import {isSeerExplorerEnabled} from 'sentry/utils/seer/isSeerExplorerEnabled';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

import {buildAskSeerPrompt} from './askSeer';
import {DroppedDataDrawer} from './droppedDataDrawer';

const DROPPED_DATA_DRAWER_PARSERS = {droppedData: parseAsString};

const loadDroppedDataQuery = createLoader(DROPPED_DATA_DRAWER_PARSERS);

interface UseDroppedDataDrawerOptions {
  enabled?: boolean;
}

export function useDroppedDataDrawer(
  {dataset, interval, projects}: UseDroppedDataParams,
  {enabled = true}: UseDroppedDataDrawerOptions = {}
) {
  const organization = useOrganization();
  const {openDrawer, isDrawerOpen, isAnyDrawerOpen} = useDrawer();
  const {pathname} = useLocation();
  // The param carries the dataset so a page with several charts opens the drawer
  // for the chart whose dataset matches, not whichever mounts first.
  const paramValue = DiscoverDatasetToUrlParam[dataset];
  const [{droppedData}, setDrawerQuery] = useQueryStates(DROPPED_DATA_DRAWER_PARSERS);
  const isDrawerInUrl = droppedData === paramValue;
  const renderedQueryRef = useRef({interval, projects});

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
    const query = {interval, projects};
    const isStale = isDrawerOpen && !isEqual(renderedQueryRef.current, query);
    if (isAnyDrawerOpen && !isStale) {
      return;
    }
    renderedQueryRef.current = query;
    openDrawer(
      () => (
        <DroppedDataDrawer
          dataset={dataset}
          interval={interval}
          projects={projects}
          onAskSeer={onAskSeer}
        />
      ),
      {
        ariaLabel: droppedAndFilteredLabel(dataset),
        drawerKey: 'dropped-data-drawer',
        shouldCloseOnLocationChange: nextLocation =>
          nextLocation.pathname !== pathname ||
          loadDroppedDataQuery(nextLocation.search ?? '').droppedData !== paramValue,
        onClose: () => {
          void setDrawerQuery({droppedData: null}, {history: 'replace'});
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
    paramValue,
    interval,
    projects,
    onAskSeer,
    pathname,
    setDrawerQuery,
  ]);

  return useCallback(() => {
    trackAnalytics('explore.dropped_data.drawer_opened', {organization, dataset});
    void setDrawerQuery({droppedData: paramValue}, {history: 'push'});
  }, [organization, dataset, paramValue, setDrawerQuery]);
}
