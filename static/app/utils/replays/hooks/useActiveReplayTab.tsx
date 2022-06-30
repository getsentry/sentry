import {useCallback} from 'react';

import {t} from 'sentry/locale';
import useUrlHash from 'sentry/utils/replays/hooks/useUrlHash';

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
  const {getHashValue, setHashValue} = useUrlHash('t_main', DEFAULT_TAB);

  const hashValue = getHashValue();

  return {
    getActiveTab: useCallback(
      () => (isReplayTab(hashValue || '') ? hashValue : DEFAULT_TAB),
      [hashValue]
    ),
    setActiveTab: (value: keyof typeof ReplayTabs) => setHashValue(value),
  };
}

export default useActiveReplayTab;
