import {useCallback} from 'react';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {defined} from 'sentry/utils';
import {useOrganization} from 'sentry/utils/useOrganization';

export enum TabKey {
  AI = 'ai',
  BREADCRUMBS = 'breadcrumbs',
  CONSOLE = 'console',
  ERRORS = 'errors',
  MEMORY = 'memory',
  NETWORK = 'network',
  TAGS = 'tags',
  TRACE = 'trace',
  LOGS = 'logs',
  PLAYLIST = 'playlist',
}

function isReplayTab({tab, isVideoReplay}: {isVideoReplay: boolean; tab: string}) {
  const supportedTabs = [
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

  if (isVideoReplay) {
    return supportedTabs.includes(tab as TabKey);
  }

  return Object.values<string>(TabKey).includes(tab);
}

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
    parseAsStringLiteral(Object.values(TabKey))
  );

  return {
    getActiveTab: useCallback(
      () =>
        tabParam && isReplayTab({tab: tabParam, isVideoReplay}) ? tabParam : defaultTab,
      [tabParam, defaultTab, isVideoReplay]
    ),
    setActiveTab: useCallback(
      (value: string) => {
        const lower = value.toLowerCase() as TabKey;
        setTabParam(isReplayTab({tab: lower, isVideoReplay}) ? lower : defaultTab);
      },
      [setTabParam, defaultTab, isVideoReplay]
    ),
  };
}
