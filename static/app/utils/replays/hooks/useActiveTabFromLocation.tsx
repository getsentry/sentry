import {isReplayTab, ReplayTabs} from 'sentry/views/replays/types';

const DEFAULT_TAB = ReplayTabs.PERFORMANCE;

function useActiveTabFromLocation() {
  const hash = location.hash.replace(/^#/, '');
  const tabFromHash = isReplayTab(hash) ? hash : DEFAULT_TAB;

  return tabFromHash;
}

export default useActiveTabFromLocation;
