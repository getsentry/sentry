import {useCallback} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {GroupIdProvider} from 'sentry/views/issueDetails/groupIdContext';
import {ActivityDrawer} from 'sentry/views/issueDetails/sidebar/activityDrawer';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

interface UseIssueActivityDrawerProps {
  group: Group;
}

export function useIssueActivityDrawer({group}: UseIssueActivityDrawerProps) {
  const {openDrawer} = useDrawer();
  const {baseUrl} = useGroupDetailsRoute();
  const navigate = useNavigate();
  const location = useLocation();

  const openIssueActivityDrawer = useCallback(() => {
    openDrawer(
      () => (
        <GroupIdProvider groupId={group.id}>
          <ActivityDrawer />
        </GroupIdProvider>
      ),
      {
        ariaLabel: t('Issue Activity'),
        drawerKey: 'issue-activity-drawer',
        onClose: () => {
          navigate(
            {
              pathname: baseUrl,
              query: {
                ...location.query,
                filter: undefined,
              },
            },
            {replace: true, preventScrollReset: true}
          );
        },
        shouldCloseOnLocationChange: newLocation => {
          return !newLocation.pathname.includes('/activity');
        },
      }
    );
  }, [openDrawer, baseUrl, navigate, location.query, group.id]);

  return {openIssueActivityDrawer};
}
