import {useCallback} from 'react';

import {t} from 'sentry/locale';
import useUrlParams from 'sentry/utils/replays/hooks/useUrlParams';

export const ReplayTabs = {
  console: t('Console'),
  network: t('Network'),
  trace: t('Trace'),
  issues: t('Issues'),
  tags: t('Tags'),
  memory: t('Memory'),
};

export function isReplayTab(tab: string): tab is keyof typeof ReplayTabs {
  return tab in ReplayTabs;
}

const DEFAULT_TAB = 'console';

function useActiveReplayTab() {
  const {getParamValue, setParamValue} = useUrlParams('t_main', DEFAULT_TAB);

  const paramValue = getParamValue();

  return {
    getActiveTab: useCallback(
      () => (isReplayTab(paramValue || '') ? paramValue : DEFAULT_TAB),
      [paramValue]
    ),
    setActiveTab: (value: keyof typeof ReplayTabs) => setParamValue(value),
  };
}

export default useActiveReplayTab;
