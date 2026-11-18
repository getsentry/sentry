import {useCallback} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SimilarIssuesDrawer} from 'sentry/views/issueDetails/groupSimilarIssues/similarIssuesDrawer';
import {IssueDetailsDrawer} from 'sentry/views/issueDetails/issueDetailsQueryParams';

import {useIssueDetailsDrawerOptions} from './useIssueDetailsDrawerOptions';

export function useSimilarIssuesDrawer({
  group,
  project,
}: {
  group: Group;
  project: Project;
}) {
  const {openDrawer} = useDrawer();
  const {onClose, shouldCloseOnLocationChange} = useIssueDetailsDrawerOptions({
    drawer: IssueDetailsDrawer.SIMILAR_ISSUES,
    groupId: group.id,
    history: 'replace',
  });
  const organization = useOrganization();

  const openSimilarIssuesDrawer = useCallback(() => {
    trackAnalytics('issue_details.similar_issues.drawer_opened', {
      organization,
      group_id: group.id,
      project_id: project.id,
    });
    openDrawer(() => <SimilarIssuesDrawer group={group} />, {
      drawerKey: 'similar-issues-drawer',
      ariaLabel: t('Similar Issues'),
      shouldCloseOnInteractOutside: () => false,
      onClose,
      shouldCloseOnLocationChange,
    });
  }, [openDrawer, group, project, onClose, shouldCloseOnLocationChange, organization]);

  return {openSimilarIssuesDrawer};
}
