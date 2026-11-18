import {useCallback} from 'react';

import {
  IssueDetailsDrawer,
  useIssueDetailsDrawerParams,
} from 'sentry/views/issueDetails/issueDetailsQueryParams';

import {DrawerTab} from './types';

function setTabDisabled(_tab: DrawerTab) {
  return Promise.resolve(new URLSearchParams());
}

export function useDrawerTab({enabled}: {enabled: boolean}) {
  const [{type}, setDrawerParams] = useIssueDetailsDrawerParams(
    IssueDetailsDrawer.DISTRIBUTIONS
  );
  const setTab = useCallback(
    (tab: DrawerTab) => setDrawerParams({type: tab}),
    [setDrawerParams]
  );

  return enabled
    ? {tab: type ?? DrawerTab.TAGS, setTab}
    : {tab: DrawerTab.TAGS, setTab: setTabDisabled};
}
