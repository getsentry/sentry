import {useCallback, useEffect, useMemo, useState} from 'react';
import * as qs from 'query-string';

import {t} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useTraceContextSections} from 'sentry/views/performance/newTraceDetails/useTraceContextSections';

export enum TraceLayoutTabKeys {
  WATERFALL = 'waterfall',
  TAGS = 'tags',
  ATTRIBUTES = 'attributes',
  PROFILES = 'profiles',
  LOGS = 'logs',
  SUMMARY = 'summary',
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
  [TraceLayoutTabKeys.TAGS]: {slug: TraceLayoutTabKeys.TAGS, label: t('Tags')},
  [TraceLayoutTabKeys.PROFILES]: {
    slug: TraceLayoutTabKeys.PROFILES,
    label: t('Profiles'),
  },
  [TraceLayoutTabKeys.ATTRIBUTES]: {
    slug: TraceLayoutTabKeys.ATTRIBUTES,
    label: t('Attributes'),
  },
  [TraceLayoutTabKeys.LOGS]: {slug: TraceLayoutTabKeys.LOGS, label: t('Logs')},
  [TraceLayoutTabKeys.SUMMARY]: {slug: TraceLayoutTabKeys.SUMMARY, label: t('Summary')},
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

  if (sections.hasTags) {
    tabOptions.push(TAB_DEFINITIONS[TraceLayoutTabKeys.ATTRIBUTES]);
  }

  if (sections.hasProfiles) {
    tabOptions.push(TAB_DEFINITIONS[TraceLayoutTabKeys.PROFILES]);
  }

  if (sections.hasLogs) {
    tabOptions.push(TAB_DEFINITIONS[TraceLayoutTabKeys.LOGS]);
  }

  if (sections.hasSummary) {
    tabOptions.push(TAB_DEFINITIONS[TraceLayoutTabKeys.SUMMARY]);
  }

  return tabOptions;
}

interface UseTraceLayoutTabsProps {
  logs: OurLogsResponseItem[] | undefined;
  rootEventResults: TraceRootEventQueryResults;
  tree: TraceTree;
}

export function useTraceLayoutTabs({
  tree,
  rootEventResults,
  logs,
}: UseTraceLayoutTabsProps): TraceLayoutTabsConfig {
  const navigate = useNavigate();
  const sections = useTraceContextSections({
    tree,
    rootEventResults,
    logs,
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
