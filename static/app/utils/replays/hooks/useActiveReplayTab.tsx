import {useCallback, useMemo} from 'react';

import {parseSearch} from 'sentry/components/searchSyntax/parser';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useUrlParams from 'sentry/utils/useUrlParams';

export enum TabKey {
  CONSOLE = 'console',
  DOM = 'dom',
  NETWORK = 'network',
  TRACE = 'trace',
  ISSUES = 'issues',
  MEMORY = 'memory',
}

function isReplayTab(tab: string): tab is TabKey {
  return Object.values<string>(TabKey).includes(tab);
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
    return TabKey.DOM;
  }

  return TabKey.CONSOLE;
}

function useActiveReplayTab() {
  const defaultTab = useDefaultTab();
  const {getParamValue, setParamValue} = useUrlParams('t_main', defaultTab);

  const paramValue = (getParamValue() || '').toLowerCase();

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
