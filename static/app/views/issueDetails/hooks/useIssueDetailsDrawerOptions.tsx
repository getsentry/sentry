import {useCallback, useEffect, useRef} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  makeIssueDetailsLocation,
  type IssueDetailsDrawer,
} from 'sentry/views/issueDetails/issueDetailsQueryParams';
import {
  getIssueDetailsDrawer,
  useIssueDetailsParams,
} from 'sentry/views/issueDetails/useGroupDetailsRoute';

/**
 * The `onClose` and `shouldCloseOnLocationChange` options for a drawer opened
 * from the issue details URL.
 *
 * Closing removes the drawer and its params from the URL and keeps the page
 * tab and event. The drawer stays open across page tab and event changes, and
 * closes once the URL no longer opens it.
 */
export function useIssueDetailsDrawerOptions({
  drawer,
  groupId,
  history,
}: {
  drawer: IssueDetailsDrawer;
  groupId: string;
  history: 'push' | 'replace';
}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const {currentTab, eventId} = useIssueDetailsParams();

  // The drawer keeps these options from when it opened, so read the location
  // at close time.
  const latestRef = useRef({location, currentTab, eventId});
  useEffect(() => {
    latestRef.current = {location, currentTab, eventId};
  }, [location, currentTab, eventId]);

  const onClose = useCallback(() => {
    const latest = latestRef.current;
    navigate(
      makeIssueDetailsLocation({
        organization,
        groupId,
        tab: latest.currentTab,
        eventId: latest.eventId,
        query: latest.location.query,
      }),
      {replace: history === 'replace', preventScrollReset: true}
    );
  }, [navigate, organization, groupId, history]);

  const shouldCloseOnLocationChange = useCallback(
    (nextLocation: Parameters<typeof getIssueDetailsDrawer>[0]) =>
      getIssueDetailsDrawer(nextLocation) !== drawer,
    [drawer]
  );

  return {onClose, shouldCloseOnLocationChange};
}
