import {useCallback, useEffect, useMemo, useState} from 'react';
import * as qs from 'query-string';

import {t} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useTraceContextSections} from 'sentry/views/performance/newTraceDetails/useTraceContextSections';

export enum TraceLayoutTabKeys {
  WATERFALL = 'waterfall',
  PROFILES = 'profiles',
  LOGS = 'logs',
  METRICS = 'metrics',
  SUMMARY = 'summary',
  AI_SPANS = 'ai-spans',
}

interface Tab {
  label: string;
  slug: TraceLayoutTabKeys;
}

export interface TraceLayoutTabsConfig {
  currentTab: TraceLayoutTabKeys;
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
  [TraceLayoutTabKeys.LOGS]: {slug: TraceLayoutTabKeys.LOGS, label: t('Logs')},
  [TraceLayoutTabKeys.METRICS]: {
    slug: TraceLayoutTabKeys.METRICS,
    label: t('Metrics'),
  },
  [TraceLayoutTabKeys.SUMMARY]: {slug: TraceLayoutTabKeys.SUMMARY, label: t('Summary')},
  [TraceLayoutTabKeys.AI_SPANS]: {
    slug: TraceLayoutTabKeys.AI_SPANS,
    label: t('AI Spans'),
  },
};

function getTabOptions({
  sections,
}: {
  sections: ReturnType<typeof useTraceContextSections>;
}): Tab[] {
  const tabOptions: Tab[] = [];

  if (sections.hasTraceEvents) {
    tabOptions.push(TAB_DEFINITIONS[TraceLayoutTabKeys.WATERFALL]);
  }

  if (sections.hasProfiles) {
    tabOptions.push(TAB_DEFINITIONS[TraceLayoutTabKeys.PROFILES]);
  }

  if (sections.hasLogs) {
    tabOptions.push(TAB_DEFINITIONS[TraceLayoutTabKeys.LOGS]);
  }

  if (sections.hasMetrics) {
    tabOptions.push(TAB_DEFINITIONS[TraceLayoutTabKeys.METRICS]);
  }

  if (sections.hasSummary) {
    tabOptions.push(TAB_DEFINITIONS[TraceLayoutTabKeys.SUMMARY]);
  }

  if (sections.hasAiSpans) {
    tabOptions.push(TAB_DEFINITIONS[TraceLayoutTabKeys.AI_SPANS]);
  }

  return tabOptions;
}

interface UseTraceLayoutTabsProps {
  logs: OurLogsResponseItem[] | undefined;
  metrics: {count: number} | undefined;
  tree: TraceTree;
}

export function useTraceLayoutTabs({
  tree,
  logs,
  metrics,
}: UseTraceLayoutTabsProps): TraceLayoutTabsConfig {
  const navigate = useNavigate();
  const sections = useTraceContextSections({
    tree,
    logs,
    metrics,
  });
  const tabOptions = getTabOptions({sections: {...sections}});

  const queryParams = qs.parse(window.location.search);
  const tabSlugFromUrl = queryParams.tab;
  const initialTab =
    tabOptions.find(tab => tab.slug === tabSlugFromUrl) ??
    (sections.hasTraceEvents
      ? TAB_DEFINITIONS[TraceLayoutTabKeys.WATERFALL]
      : TAB_DEFINITIONS[TraceLayoutTabKeys.LOGS]);

  const [currentTab, setCurrentTab] = useState<Tab['slug']>(initialTab.slug);

  const onTabChange = useCallback(
    (slug: Tab['slug']) => {
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
      setCurrentTab(slug);
    },
    [navigate, queryParams]
  );

  // Update the tab when the tabOptions change
  useEffect(() => {
    setCurrentTab(initialTab.slug);
  }, [tabOptions, initialTab]);

  return useMemo(
    () => ({
      tabOptions,
      currentTab,
      onTabChange,
    }),
    [tabOptions, currentTab, onTabChange]
  );
}
