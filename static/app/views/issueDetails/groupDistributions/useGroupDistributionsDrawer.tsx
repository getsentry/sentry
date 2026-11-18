import {useCallback} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {GroupDistributionsDrawer} from 'sentry/views/issueDetails/groupDistributionsDrawer';
import {GroupIdProvider} from 'sentry/views/issueDetails/groupIdContext';
import {useIssueDetailsDrawerOptions} from 'sentry/views/issueDetails/hooks/useIssueDetailsDrawerOptions';
import {IssueDetailsDrawer} from 'sentry/views/issueDetails/issueDetailsQueryParams';

/**
 * Shared tags and feature flags distributions drawer used by issue details.
 */
export function useGroupDistributionsDrawer({
  group,
  includeFeatureFlagsTab,
}: {
  group: Group;
  includeFeatureFlagsTab: boolean;
}) {
  const {openDrawer} = useDrawer();
  const {onClose, shouldCloseOnLocationChange} = useIssueDetailsDrawerOptions({
    drawer: IssueDetailsDrawer.DISTRIBUTIONS,
    groupId: group.id,
    history: 'push',
  });

  const openDistributionsDrawer = useCallback(() => {
    openDrawer(
      () => (
        <GroupIdProvider groupId={group.id}>
          <GroupDistributionsDrawer
            group={group}
            includeFeatureFlagsTab={includeFeatureFlagsTab}
          />
        </GroupIdProvider>
      ),
      {
        ariaLabel: t('Distributions Drawer'),
        drawerKey: 'distributions-drawer',
        onClose,
        shouldCloseOnLocationChange,
      }
    );
  }, [openDrawer, group, includeFeatureFlagsTab, onClose, shouldCloseOnLocationChange]);

  return {openDistributionsDrawer};
}
