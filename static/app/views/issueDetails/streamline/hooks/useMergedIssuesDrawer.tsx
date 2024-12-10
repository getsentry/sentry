import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {MergedIssuesDrawer} from 'sentry/views/issueDetails/groupMerged/mergedIssuesDrawer';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function useMergedIssuesDrawer({
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

  const openMergedIssuesDrawer = useCallback(() => {
    openDrawer(() => <MergedIssuesDrawer group={group} project={project} />, {
      ariaLabel: t('Merged Issues'),
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
    });
  }, [openDrawer, group, project, baseUrl, navigate, location.query]);

  return {openMergedIssuesDrawer};
}
