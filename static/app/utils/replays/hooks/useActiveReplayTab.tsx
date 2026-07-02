import {useCallback} from 'react';
import {createParser, parseAsStringLiteral, useQueryState, useQueryStates} from 'nuqs';

import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {defined} from 'sentry/utils/defined';
import {replayDetailFilterParsers} from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import {useOrganization} from 'sentry/utils/useOrganization';

export enum TabKey {
  AI = 'ai',
  BREADCRUMBS = 'breadcrumbs',
  CONSOLE = 'console',
  ERRORS = 'errors',
  LOGS = 'logs',
  MEMORY = 'memory',
  NETWORK = 'network',
  PLAYLIST = 'playlist',
  TAGS = 'tags',
  TRACE = 'trace',
}

function isReplayTab({tab, isVideoReplay}: {isVideoReplay: boolean; tab: string}) {
  if (isVideoReplay) {
    const supportedVideoTabs = [
      TabKey.AI,
      TabKey.BREADCRUMBS,
      TabKey.CONSOLE,
      TabKey.ERRORS,
      TabKey.LOGS,
      TabKey.NETWORK,
      TabKey.PLAYLIST,
      TabKey.TAGS,
      TabKey.TRACE,
    ];
    return supportedVideoTabs.includes(tab as TabKey);
  }

  return Object.values<string>(TabKey).includes(tab);
}

const tabKeyParser = createParser<TabKey>({
  parse: value => parseAsStringLiteral(Object.values(TabKey)).parse(value.toLowerCase()),
  serialize: value => value,
});

export function useActiveReplayTab({isVideoReplay = false}: {isVideoReplay?: boolean}) {
  const organization = useOrganization();
  const {areAiFeaturesAllowed} = useOrganizationSeerSetup();
  const hasMobileSummary = organization.features.includes('replay-ai-summaries-mobile');
  const hasAiSummary =
    organization.features.includes('replay-ai-summaries') && areAiFeaturesAllowed;

  const isAiTabAvailable = hasAiSummary && (!isVideoReplay || hasMobileSummary);

  const defaultTab =
    defined(areAiFeaturesAllowed) && areAiFeaturesAllowed && isAiTabAvailable
      ? TabKey.AI
      : TabKey.BREADCRUMBS;

  const [tabParam, setTabParam] = useQueryState(
    't_main',
    tabKeyParser
      .withDefault(defaultTab)
      .withOptions({clearOnDefault: false, shallow: true})
  );
  const [, clearReplayDetailFilters] = useQueryStates(replayDetailFilterParsers, {
    history: 'replace',
    shallow: true,
    throttleMs: 0,
  });

  return {
    getActiveTab: useCallback(
      () =>
        tabParam && isReplayTab({tab: tabParam, isVideoReplay}) ? tabParam : defaultTab,
      [tabParam, defaultTab, isVideoReplay]
    ),
    setActiveTab: useCallback(
      (value: string) => {
        const lower = value.toLowerCase() as TabKey;
        const nextTab = isReplayTab({tab: lower, isVideoReplay}) ? lower : defaultTab;
        if (nextTab !== tabParam) {
          clearReplayDetailFilters(null);
        }
        setTabParam(nextTab);
      },
      [clearReplayDetailFilters, setTabParam, defaultTab, isVideoReplay, tabParam]
    ),
  };
}
