import {useCallback} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {GroupIdProvider} from 'sentry/views/issueDetails/groupIdContext';
import {IssueDetailsDrawer} from 'sentry/views/issueDetails/issueDetailsQueryParams';
import {ActivityDrawer} from 'sentry/views/issueDetails/sidebar/activityDrawer';

import {useIssueDetailsDrawerOptions} from './useIssueDetailsDrawerOptions';

interface UseIssueActivityDrawerProps {
  group: Group;
}

export function useIssueActivityDrawer({group}: UseIssueActivityDrawerProps) {
  const {openDrawer} = useDrawer();
  const {onClose, shouldCloseOnLocationChange} = useIssueDetailsDrawerOptions({
    drawer: IssueDetailsDrawer.ACTIVITY,
    groupId: group.id,
    history: 'replace',
  });

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
        onClose,
        shouldCloseOnLocationChange,
      }
    );
  }, [openDrawer, onClose, shouldCloseOnLocationChange, group.id]);

  return {openIssueActivityDrawer};
}
