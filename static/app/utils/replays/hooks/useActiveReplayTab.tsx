import {useCallback, useMemo} from 'react';

import {parseSearch} from 'sentry/components/searchSyntax/parser';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useUrlParams from 'sentry/utils/useUrlParams';

export enum TabKey {
  console = 'console',
  dom = 'dom',
  network = 'network',
  trace = 'trace',
  issues = 'issues',
  memory = 'memory',
}

function isReplayTab(tab: string): tab is TabKey {
  return tab in TabKey;
}

function useDefaultTab() {
  const location = useLocation();

  const hasClickSearch = useMemo(() => {
    const parsed = parseSearch(decodeScalar(location.query.query) || '');
    return parsed?.some(
      token => token.type === 'filter' && token.key.text.startsWith('click.')
    );
  }, [location.query.query]);

  if (hasClickSearch) {
    return TabKey.dom;
  }

  return TabKey.console;
}

function useActiveReplayTab() {
  const defaultTab = useDefaultTab();
  const {getParamValue, setParamValue} = useUrlParams('t_main', defaultTab);

  const paramValue = getParamValue();

  return {
    getActiveTab: useCallback(
      () => (isReplayTab(paramValue || '') ? (paramValue as TabKey) : defaultTab),
      [paramValue, defaultTab]
    ),
    setActiveTab: useCallback(
      (value: string) =>
        isReplayTab(value) ? setParamValue(value) : setParamValue(defaultTab),
      [setParamValue, defaultTab]
    ),
  };
}

export default useActiveReplayTab;
