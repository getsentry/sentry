import {isReplayTab, ReplayTabs} from '../types';

const DEFAULT_TAB = ReplayTabs.CONSOLE;

function useActiveTabFromLocation() {
  const hash = location.hash.replace(/^#/, '');
  const tabFromHash = isReplayTab(hash) ? hash : DEFAULT_TAB;

  return tabFromHash;
}

export default useActiveTabFromLocation;
