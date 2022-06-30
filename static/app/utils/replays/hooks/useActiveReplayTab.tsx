import useUrlHash from 'sentry/utils/replays/hooks/useUrlHash';

export enum ReplayTabs {
  CONSOLE = 'console',
  NETWORK = 'network',
  TRACE = 'trace',
  ISSUES = 'issues',
  TAGS = 'tags',
  MEMORY = 'memory',
}

export function isReplayTab(tab: string): tab is ReplayTabs {
  return tab.toUpperCase() in ReplayTabs;
}

const DEFAULT_TAB = ReplayTabs.CONSOLE;

function useActiveReplayTab() {
  const {getHashValue, setHashValue} = useUrlHash('t_main', DEFAULT_TAB);

  const hashValue = getHashValue();
  const activeTab = isReplayTab(hashValue || '') ? hashValue : DEFAULT_TAB;

  return {
    activeTab,
    setActiveTab: (value: ReplayTabs) => setHashValue(value),
  };
}

export default useActiveReplayTab;
