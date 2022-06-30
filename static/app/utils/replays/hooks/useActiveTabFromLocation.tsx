import {isReplayTab, ReplayTabs} from 'sentry/views/replays/types';

const DEFAULT_TAB = ReplayTabs.CONSOLE;

function useActiveTabFromLocation() {
  const hash = location.hash.replace(/^#/, '');
  const tabFromHash = isReplayTab(hash) ? hash.replace('%20', ' ') : DEFAULT_TAB;

  return tabFromHash;
}

export default useActiveTabFromLocation;
