import {useCallback} from 'react';

import {t} from 'sentry/locale';
import useUrlParams from 'sentry/utils/replays/hooks/useUrlParams';

export const ReplayTabs = {
  console: t('Console'),
  network: t('Network Waterfall'),
  network_table: t('Network Table'),
  trace: t('Trace'),
  issues: t('Issues'),
  tags: t('Tags'),
  memory: t('Memory'),
};

type TabKey = keyof typeof ReplayTabs;

export function isReplayTab(tab: string): tab is TabKey {
  return tab in ReplayTabs;
}

const DEFAULT_TAB = 'console';

function useActiveReplayTab() {
  const {getParamValue, setParamValue} = useUrlParams('t_main', DEFAULT_TAB);

  const paramValue = getParamValue();

  return {
    getActiveTab: useCallback(
      () => (isReplayTab(paramValue || '') ? (paramValue as TabKey) : DEFAULT_TAB),
      [paramValue]
    ),
    setActiveTab: (value: string) =>
      isReplayTab(value) ? setParamValue(value) : setParamValue(DEFAULT_TAB),
  };
}

export default useActiveReplayTab;
