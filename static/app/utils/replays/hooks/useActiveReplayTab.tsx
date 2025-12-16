import {useCallback} from 'react';

import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {defined} from 'sentry/utils';
import useUrlParams from 'sentry/utils/url/useUrlParams';
import useOrganization from 'sentry/utils/useOrganization';

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
  const supportedVideoTabs = [
    TabKey.TAGS,
    TabKey.ERRORS,
    TabKey.BREADCRUMBS,
    TabKey.NETWORK,
    TabKey.CONSOLE,
    TabKey.TRACE,
    TabKey.LOGS,
    TabKey.AI,
    TabKey.PLAYLIST,
  ];

  if (isVideoReplay) {
    return supportedVideoTabs.includes(tab as TabKey);
  }

  return Object.values<string>(TabKey).includes(tab);
}

function useActiveReplayTab({isVideoReplay = false}: {isVideoReplay?: boolean}) {
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

  const {getParamValue, setParamValue} = useUrlParams('t_main', defaultTab);

  const paramValue = getParamValue()?.toLowerCase() ?? '';

  return {
    getActiveTab: useCallback(
      () => (isReplayTab({tab: paramValue, isVideoReplay}) ? paramValue : defaultTab),
      [paramValue, defaultTab, isVideoReplay]
    ),
    setActiveTab: useCallback(
      (value: string) => {
        setParamValue(
          isReplayTab({tab: value.toLowerCase(), isVideoReplay})
            ? value.toLowerCase()
            : defaultTab
        );
      },
      [setParamValue, defaultTab, isVideoReplay]
    ),
  };
}

export default useActiveReplayTab;
