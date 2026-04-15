import {useCallback} from 'react';

import {useDrawer} from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SimilarIssuesDrawer} from 'sentry/views/issueDetails/groupSimilarIssues/similarIssuesDrawer';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function useSimilarIssuesDrawer({
  group,
  project,
}: {
  group: Group;
  project: Project;
}) {
  const {openDrawer} = useDrawer();
  const {baseUrl} = useGroupDetailsRoute();
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();

  const openSimilarIssuesDrawer = useCallback(() => {
    trackAnalytics('issue_details.similar_issues.drawer_opened', {
      organization,
      group_id: group.id,
      project_id: project.id,
    });
    openDrawer(() => <SimilarIssuesDrawer group={group} project={project} />, {
      ariaLabel: t('Similar Issues'),
      shouldCloseOnInteractOutside: () => false,
      onClose: () => {
        // Remove drawer state from URL
        navigate(
          {
            pathname: baseUrl,
            query: {
              ...location.query,
              cursor: undefined,
            },
          },
          {replace: true, preventScrollReset: true}
        );
      },
    });
  }, [openDrawer, group, project, baseUrl, navigate, location.query, organization]);

  return {openSimilarIssuesDrawer};
}
