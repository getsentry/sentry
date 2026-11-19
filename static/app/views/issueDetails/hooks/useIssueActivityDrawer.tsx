import {useCallback} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {GroupIdProvider} from 'sentry/views/issueDetails/groupIdContext';
import {ActivityDrawer} from 'sentry/views/issueDetails/sidebar/activityDrawer';

interface UseIssueActivityDrawerProps {
  getReturnPath: () => string;
  group: Group;
}

export function useIssueActivityDrawer({
  getReturnPath,
  group,
}: UseIssueActivityDrawerProps) {
  const {openDrawer} = useDrawer();
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
              pathname: getReturnPath(),
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
  }, [openDrawer, getReturnPath, navigate, location.query, group.id]);

  return {openIssueActivityDrawer};
}
