import {useCallback, useEffect, useMemo, useState} from 'react';
import * as qs from 'query-string';

import {t} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import {
  getTraceMetaLogsCount,
  getTraceMetaMetricsCount,
  type TraceMetaQueryResults,
} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useTraceContextSections} from 'sentry/views/performance/newTraceDetails/useTraceContextSections';
import type {TraceOverviewData} from 'sentry/views/performance/newTraceDetails/useTraceOverviewData';

export enum TraceLayoutTabKeys {
  WATERFALL = 'waterfall',
  PROFILES = 'profiles',
  LOGS = 'logs',
  METRICS = 'metrics',
  AI_SPANS = 'ai-spans',
}

interface Tab {
  label: string;
  slug: TraceLayoutTabKeys;
}

export interface TraceLayoutTabsConfig {
  currentTab: TraceLayoutTabKeys;
  isLoading: boolean;
  onTabChange: (slug: TraceLayoutTabKeys) => void;
  tabOptions: Tab[];
}

const TAB_DEFINITIONS: Record<TraceLayoutTabKeys, Tab> = {
  [TraceLayoutTabKeys.WATERFALL]: {
    slug: TraceLayoutTabKeys.WATERFALL,
    label: t('Waterfall'),
  },
  [TraceLayoutTabKeys.PROFILES]: {
    slug: TraceLayoutTabKeys.PROFILES,
    label: t('Profiles'),
  },
  [TraceLayoutTabKeys.LOGS]: {
    slug: TraceLayoutTabKeys.LOGS,
    label: t('Logs'),
  },
  [TraceLayoutTabKeys.METRICS]: {
    slug: TraceLayoutTabKeys.METRICS,
    label: t('Application Metrics'),
  },
  [TraceLayoutTabKeys.AI_SPANS]: {
    slug: TraceLayoutTabKeys.AI_SPANS,
    label: t('Agent Timeline'),
  },
};

function getTabOptions({
  sections,
  overview,
  tabSlugFromUrl,
}: {
  overview: TraceOverviewData;
  sections: ReturnType<typeof useTraceContextSections>;
  tabSlugFromUrl: string | undefined;
}): Tab[] {
  const tabOptions: Tab[] = [];

  if (sections.hasTraceEvents) {
    tabOptions.push(TAB_DEFINITIONS[TraceLayoutTabKeys.WATERFALL]);
  }

  if (sections.hasProfiles) {
    tabOptions.push(TAB_DEFINITIONS[TraceLayoutTabKeys.PROFILES]);
  }

  if (
    sections.hasLogs ||
    ((overview.logs.availability === 'loading' ||
      overview.logs.availability === 'unknown') &&
      tabSlugFromUrl === TraceLayoutTabKeys.LOGS)
  ) {
    tabOptions.push(TAB_DEFINITIONS[TraceLayoutTabKeys.LOGS]);
  }

  if (
    sections.hasMetrics ||
    ((overview.metrics.availability === 'loading' ||
      overview.metrics.availability === 'unknown') &&
      tabSlugFromUrl === TraceLayoutTabKeys.METRICS)
  ) {
    tabOptions.push(TAB_DEFINITIONS[TraceLayoutTabKeys.METRICS]);
  }

  if (sections.hasAiSpans) {
    tabOptions.push(TAB_DEFINITIONS[TraceLayoutTabKeys.AI_SPANS]);
  }

  return tabOptions;
}

export function getInitialTab({
  isLoading,
  logsEnabled = true,
  metricsEnabled = true,
  meta,
  sections,
  tabOptions,
  tabSlugFromUrl,
}: {
  isLoading: boolean;
  sections: ReturnType<typeof useTraceContextSections>;
  tabOptions: Tab[];
  tabSlugFromUrl: string | undefined;
  logsEnabled?: boolean;
  meta?: TraceMetaQueryResults['data'];
  metricsEnabled?: boolean;
}): Tab {
  const hasNoLogs = logsEnabled && getTraceMetaLogsCount(meta) === 0;
  const hasNoMetrics = metricsEnabled && getTraceMetaMetricsCount(meta) === 0;

  const shouldKeepLogsTabWhileLoading =
    logsEnabled && !hasNoLogs && tabSlugFromUrl === TraceLayoutTabKeys.LOGS;

  const shouldKeepMetricsTabWhileLoading =
    metricsEnabled && !hasNoMetrics && tabSlugFromUrl === TraceLayoutTabKeys.METRICS;

  if (isLoading) {
    if (shouldKeepLogsTabWhileLoading) {
      return TAB_DEFINITIONS[TraceLayoutTabKeys.LOGS];
    }

    if (shouldKeepMetricsTabWhileLoading) {
      return TAB_DEFINITIONS[TraceLayoutTabKeys.METRICS];
    }

    if (tabSlugFromUrl === TraceLayoutTabKeys.AI_SPANS) {
      return TAB_DEFINITIONS[TraceLayoutTabKeys.AI_SPANS];
    }
  }

  const tabFromUrl = tabOptions.find(tab => tab.slug === tabSlugFromUrl);
  if (tabFromUrl) {
    return tabFromUrl;
  }

  if (sections.hasTraceEvents) {
    return TAB_DEFINITIONS[TraceLayoutTabKeys.WATERFALL];
  }

  if (sections.hasLogs) {
    return TAB_DEFINITIONS[TraceLayoutTabKeys.LOGS];
  }

  if (sections.hasMetrics) {
    return TAB_DEFINITIONS[TraceLayoutTabKeys.METRICS];
  }

  return TAB_DEFINITIONS[TraceLayoutTabKeys.WATERFALL];
}

interface UseTraceLayoutTabsProps {
  isLoading: boolean;
  logsEnabled: boolean;
  metricsEnabled: boolean;
  overview: TraceOverviewData;
  tree: TraceTree;
  meta?: TraceMetaQueryResults['data'];
}

export function useTraceLayoutTabs({
  isLoading,
  tree,
  meta,
  logsEnabled,
  metricsEnabled,
  overview,
}: UseTraceLayoutTabsProps): TraceLayoutTabsConfig {
  const navigate = useNavigate();
  const organization = useOrganization();
  const queryParams = qs.parse(window.location.search);
  const tabSlugFromUrl =
    typeof queryParams.tab === 'string' ? queryParams.tab : undefined;
  const sections = useTraceContextSections({
    tree,
    logs: overview.logs.representative,
    logsCount: overview.logs.count,
    meta,
    metrics: undefined,
    metricsCount: overview.metrics.count,
    logsEnabled,
    metricsEnabled,
  });
  const tabOptions = getTabOptions({overview, sections, tabSlugFromUrl});

  const initialTab = getInitialTab({
    isLoading,
    logsEnabled,
    metricsEnabled,
    meta,
    sections,
    tabOptions,
    tabSlugFromUrl,
  });

  const [selectedTab, setSelectedTab] = useState(initialTab.slug);
  const isSelectedTabAvailable = tabOptions.some(tab => tab.slug === selectedTab);
  const currentTab = isLoading || isSelectedTabAvailable ? selectedTab : initialTab.slug;
  const isCurrentTabRequested = queryParams.tab === currentTab;

  const onTabChange = useCallback(
    (slug: Tab['slug']) => {
      if (slug === TraceLayoutTabKeys.AI_SPANS) {
        traceAnalytics.trackAITabClicked(organization);
      }
      navigate(
        {
          pathname: location.pathname,
          query: {
            ...queryParams,
            tab: slug,
          },
        },
        {replace: true}
      );
      setSelectedTab(slug);
    },
    [navigate, queryParams, organization]
  );

  // Keep the stored selection in sync with URL and availability changes. The
  // render above falls back synchronously so stale content never mounts first.
  useEffect(() => {
    setSelectedTab(initialTab.slug);
  }, [initialTab.slug]);

  return useMemo(
    () => ({
      tabOptions,
      currentTab,
      isLoading: isLoading && !isCurrentTabRequested,
      onTabChange,
    }),
    [tabOptions, currentTab, isCurrentTabRequested, isLoading, onTabChange]
  );
}
