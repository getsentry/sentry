import {useCallback} from 'react';

import useUrlParams from 'sentry/utils/useUrlParams';

export enum TabKey {
  A11Y = 'a11y',
  BREADCRUMBS = 'breadcrumbs',
  CONSOLE = 'console',
  ERRORS = 'errors',
  MEMORY = 'memory',
  NETWORK = 'network',
  TAGS = 'tags',
  TRACE = 'trace',
}

function isReplayTab(tab: string): tab is TabKey {
  return Object.values<string>(TabKey).includes(tab);
}

function useActiveReplayTab({isVideoReplay}: {isVideoReplay?: boolean}) {
  const defaultTab = isVideoReplay ? TabKey.TAGS : TabKey.BREADCRUMBS;
  const {getParamValue, setParamValue} = useUrlParams('t_main', defaultTab);

  const paramValue = getParamValue()?.toLowerCase() ?? '';

  return {
    getActiveTab: useCallback(
      () => (isReplayTab(paramValue) ? (paramValue as TabKey) : defaultTab),
      [paramValue, defaultTab]
    ),
    setActiveTab: useCallback(
      (value: string) => {
        setParamValue(
          isReplayTab(value.toLowerCase()) ? value.toLowerCase() : defaultTab
        );
      },
      [setParamValue, defaultTab]
    ),
  };
}

export default useActiveReplayTab;
