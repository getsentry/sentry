import {useCallback} from 'react';

import useUrlParams from 'sentry/utils/useUrlParams';

export enum TabKey {
  console = 'console',
  dom = 'dom',
  issues = 'issues',
  memory = 'memory',
  network = 'network',
  trace = 'trace',
  trace2 = 'trace2',
}

function isReplayTab(tab: string): tab is TabKey {
  return tab in TabKey;
}

const DEFAULT_TAB = TabKey.console;

function useActiveReplayTab() {
  const {getParamValue, setParamValue} = useUrlParams('t_main', DEFAULT_TAB);

  const paramValue = getParamValue();

  return {
    getActiveTab: useCallback(
      () => (isReplayTab(paramValue || '') ? (paramValue as TabKey) : DEFAULT_TAB),
      [paramValue]
    ),
    setActiveTab: useCallback(
      (value: string) =>
        isReplayTab(value) ? setParamValue(value) : setParamValue(DEFAULT_TAB),
      [setParamValue]
    ),
  };
}

export default useActiveReplayTab;
