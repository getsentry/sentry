import {useCallback} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {MergedIssuesDrawer} from 'sentry/views/issueDetails/groupMerged/mergedIssuesDrawer';
import {IssueDetailsDrawer} from 'sentry/views/issueDetails/issueDetailsQueryParams';

import {useIssueDetailsDrawerOptions} from './useIssueDetailsDrawerOptions';

export function useMergedIssuesDrawer({
  group,
  project,
}: {
  group: Group;
  project: Project;
}) {
  const {openDrawer} = useDrawer();
  const {onClose, shouldCloseOnLocationChange} = useIssueDetailsDrawerOptions({
    drawer: IssueDetailsDrawer.MERGED,
    groupId: group.id,
    history: 'replace',
  });
  const organization = useOrganization();

  const openMergedIssuesDrawer = useCallback(() => {
    trackAnalytics('issue_details.merged_issues.drawer_opened', {
      organization,
      group_id: group.id,
      project_id: project.id,
    });
    openDrawer(() => <MergedIssuesDrawer group={group} project={project} />, {
      ariaLabel: t('Merged Issues'),
      drawerKey: 'merged-issues-drawer',
      shouldCloseOnInteractOutside: () => false,
      onClose,
      shouldCloseOnLocationChange,
    });
  }, [openDrawer, group, project, onClose, shouldCloseOnLocationChange, organization]);

  return {openMergedIssuesDrawer};
}
