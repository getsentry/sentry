import {useCallback, useEffect, useRef} from 'react';
import isEqual from 'lodash/isEqual';
import {createLoader, parseAsString, useQueryStates} from 'nuqs';

import {useDrawer} from '@sentry/scraps/drawer';

import {buildAskSeerPrompt} from 'sentry/components/droppedData/drawer/askSeer';
import {droppedAndFilteredLabel} from 'sentry/components/droppedData/outcomes';
import type {ReasonRow} from 'sentry/components/droppedData/outcomeSections';
import type {UseDroppedDataParams} from 'sentry/components/droppedData/useDroppedData';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {DroppedDataAnalyticsSource} from 'sentry/utils/analytics/exploreAnalyticsEvents';
import {DiscoverDatasetToUrlParam} from 'sentry/utils/discover/types';
import {isSeerExplorerEnabled} from 'sentry/utils/seer/isSeerExplorerEnabled';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

import {
  CHART_CONTEXT_TAB_PARSERS,
  ChartContextDrawer,
  type ChartContextTab,
} from './chartContextDrawer';

const CHART_CONTEXT_DRAWER_PARSERS = {
  droppedData: parseAsString,
  ...CHART_CONTEXT_TAB_PARSERS,
};

const loadDroppedDataQuery = createLoader(CHART_CONTEXT_DRAWER_PARSERS);

interface UseChartContextDrawerOptions {
  source: DroppedDataAnalyticsSource;
  enabled?: boolean;
  showAnnotationTabs?: boolean;
}

export function useChartContextDrawer(
  {dataset, interval, projects}: UseDroppedDataParams,
  {source, enabled = true, showAnnotationTabs = false}: UseChartContextDrawerOptions
) {
  const organization = useOrganization();
  const {openDrawer, isDrawerOpen, isAnyDrawerOpen} = useDrawer();
  const {pathname} = useLocation();
  // The param carries the dataset so a page with several charts opens the drawer
  // for the chart whose dataset matches, not whichever mounts first.
  const paramValue = DiscoverDatasetToUrlParam[dataset];
  const [{droppedData}, setDrawerQuery] = useQueryStates(CHART_CONTEXT_DRAWER_PARSERS);
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
        source,
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
    [dataset, organization, source]
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
        <ChartContextDrawer
          dataset={dataset}
          interval={interval}
          projects={projects}
          source={source}
          onAskSeer={onAskSeer}
          showAnnotationTabs={showAnnotationTabs}
        />
      ),
      {
        ariaLabel: showAnnotationTabs
          ? t('Chart Context')
          : droppedAndFilteredLabel(dataset),
        drawerKey: 'dropped-data-drawer',
        shouldCloseOnLocationChange: nextLocation =>
          nextLocation.pathname !== pathname ||
          loadDroppedDataQuery(nextLocation.search ?? '').droppedData !== paramValue,
        onClose: () => {
          void setDrawerQuery(
            {droppedData: null, contextTab: null},
            {history: 'replace'}
          );
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
    source,
    onAskSeer,
    showAnnotationTabs,
    pathname,
    setDrawerQuery,
  ]);

  return useCallback(
    (tab: ChartContextTab = 'dropped-data') => {
      if (tab === 'dropped-data') {
        trackAnalytics('explore.dropped_data.drawer_opened', {
          organization,
          dataset,
          source,
        });
      } else {
        trackAnalytics('explore.chart_context.drawer_opened', {
          organization,
          dataset,
          source,
          tab,
        });
      }
      void setDrawerQuery(
        {droppedData: paramValue, contextTab: tab === 'dropped-data' ? null : tab},
        {history: 'push'}
      );
    },
    [organization, dataset, source, paramValue, setDrawerQuery]
  );
}
