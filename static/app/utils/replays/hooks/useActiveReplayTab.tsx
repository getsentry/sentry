import {useCallback} from 'react';

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
}

function isReplayTab({tab, isVideoReplay}: {isVideoReplay: boolean; tab: string}) {
  const supportedVideoTabs = [
    TabKey.AI,
    TabKey.TAGS,
    TabKey.ERRORS,
    TabKey.BREADCRUMBS,
    TabKey.NETWORK,
    TabKey.CONSOLE,
    TabKey.TRACE,
  ];

  if (isVideoReplay) {
    return supportedVideoTabs.includes(tab as TabKey);
  }

  return Object.values<string>(TabKey).includes(tab);
}

function useActiveReplayTab({isVideoReplay = false}: {isVideoReplay?: boolean}) {
  const organization = useOrganization();

  // Use AI as default tab if user has the replay-ai-summaries feature flag, otherwise use breadcrumbs
  const defaultTab =
    organization.features.includes('replay-ai-summaries') &&
    organization.features.includes('gen-ai-features')
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
