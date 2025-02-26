import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
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

  const openSimilarIssuesDrawer = useCallback(() => {
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
          {replace: true}
        );
      },
      transitionProps: {stiffness: 1000},
    });
  }, [openDrawer, group, project, baseUrl, navigate, location.query]);

  return {openSimilarIssuesDrawer};
}
