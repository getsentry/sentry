import {useCallback} from 'react';

import {useNavigate} from 'sentry/utils/useNavigate';
import {useLocation} from 'sentry/utils/useLocation';
import {useComponentShortcuts} from 'sentry/utils/keyboardShortcuts';
import type {Event} from 'sentry/types/event';
import {Tab} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

interface UseContentNavigationShortcutsProps {
  event: Event | undefined;
}

/**
 * Hook for content navigation shortcuts (t sequence)
 * Use this in components that handle tab/content navigation
 */
export function useContentNavigationShortcuts({
  event,
}: UseContentNavigationShortcutsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const {baseUrl} = useGroupDetailsRoute();

  const navigateToTab = useCallback(
    (tab: Tab) => {
      const tabPath = tab === Tab.DETAILS ? '' : `${tab}/`;
      const eventId = event?.id ? `events/${event.id}/` : '';
      navigate(`${baseUrl}${eventId}${tabPath}${location.search}`);
    },
    [baseUrl, event?.id, location.search, navigate]
  );

  useComponentShortcuts('issue-details-navigation', [
    {
      id: 'navigate-details',
      key: 't d',
      description: 'Go to Details view',
      handler: () => navigateToTab(Tab.DETAILS),
    },
    {
      id: 'navigate-replays', 
      key: 't r',
      description: 'Go to Replays view',
      handler: () => navigateToTab(Tab.REPLAYS),
    },
    {
      id: 'navigate-attachments',
      key: 't a', 
      description: 'Go to Attachments view',
      handler: () => navigateToTab(Tab.ATTACHMENTS),
    },
    {
      id: 'navigate-feedback',
      key: 't f',
      description: 'Go to User Feedback view', 
      handler: () => navigateToTab(Tab.USER_FEEDBACK),
    },
  ]);
}