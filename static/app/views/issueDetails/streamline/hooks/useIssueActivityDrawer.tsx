import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {ActivityDrawer} from 'sentry/views/issueDetails/streamline/sidebar/activityDrawer';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

interface UseIssueActivityDrawerProps {
  group: Group;
  project: Project;
}

export function useIssueActivityDrawer({group, project}: UseIssueActivityDrawerProps) {
  const {openDrawer} = useDrawer();
  const {baseUrl} = useGroupDetailsRoute();
  const navigate = useNavigate();
  const location = useLocation();

  const openIssueActivityDrawer = useCallback(() => {
    openDrawer(() => <ActivityDrawer group={group} project={project} />, {
      ariaLabel: t('Issue Activity'),
      shouldCloseOnInteractOutside: () => false,
      onClose: () => {
        navigate(
          {
            pathname: baseUrl,
            query: {
              ...location.query,
              filter: undefined,
            },
          },
          {replace: true}
        );
      },
      transitionProps: {stiffness: 1000},
      shouldCloseOnLocationChange: () => false,
    });
  }, [openDrawer, baseUrl, navigate, location.query, group, project]);

  return {openIssueActivityDrawer};
}
