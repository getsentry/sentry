import {useCallback} from 'react';

import {ReplayDrawer} from 'sentry/components/events/eventReplay/replayDrawer';
import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function useReplaysDrawer({group, project}: {group: Group; project: Project}) {
  const {openDrawer} = useDrawer();
  const {baseUrl} = useGroupDetailsRoute();
  const navigate = useNavigate();
  const location = useLocation();

  const openReplaysDrawer = useCallback(() => {
    openDrawer(() => <ReplayDrawer group={group} project={project} />, {
      ariaLabel: t('Replays'),
      onClose: () => {
        // Remove drawer state from URL
        navigate(
          {
            pathname: baseUrl,
            query: {
              ...location.query,
              selected_replay_index: undefined,
              cursor: undefined,
            },
          },
          {replace: true}
        );
      },
    });
  }, [openDrawer, group, project, baseUrl, navigate, location.query]);

  return {openReplaysDrawer};
}
