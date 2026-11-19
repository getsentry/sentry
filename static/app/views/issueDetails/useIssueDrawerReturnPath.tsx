import {useCallback, useEffect, useRef} from 'react';

import {Tab} from './types';

export const ISSUE_DRAWER_TABS = new Set([
  Tab.ACTIVITY,
  Tab.DISTRIBUTIONS,
  Tab.MERGED,
  Tab.SIMILAR_ISSUES,
]);

export function useIssueDrawerReturnPath({
  baseUrl,
  currentTab,
  pathname,
}: {
  baseUrl: string;
  currentTab: Tab;
  pathname: string;
}) {
  const lastNonDrawerPath = useRef<string | null>(null);

  useEffect(() => {
    if (!ISSUE_DRAWER_TABS.has(currentTab)) {
      lastNonDrawerPath.current = pathname;
    }
  }, [currentTab, pathname]);

  return useCallback(
    () =>
      lastNonDrawerPath.current?.startsWith(baseUrl)
        ? lastNonDrawerPath.current
        : baseUrl,
    [baseUrl]
  );
}
