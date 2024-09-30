import {useCallback} from 'react';

import {UserFeedbackDrawer} from 'sentry/components/events/userFeedback/userFeedbackDrawer';
import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function useUserFeedbackDrawer({
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

  const openUserFeedbackDrawer = useCallback(() => {
    openDrawer(() => <UserFeedbackDrawer group={group} project={project} />, {
      ariaLabel: t('User Feedback'),
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

  return {openUserFeedbackDrawer};
}
