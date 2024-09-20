import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {GroupTagsDrawer} from 'sentry/views/issueDetails/groupTags/groupTagsDrawer';

export function useGroupTagsDrawer({
  project,
  groupId,
  openButtonRef,
}: {
  groupId: string;
  openButtonRef: React.RefObject<HTMLButtonElement>;
  project: Project;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const drawer = useDrawer();

  const openTagsDrawer = useCallback(() => {
    drawer.openDrawer(() => <GroupTagsDrawer project={project} groupId={groupId} />, {
      ariaLabel: 'tags drawer',
      onClose: () => {
        const params = new URL(window.location.href).searchParams;
        if (params.has('tagDrawerSort') || params.has('tagDrawerKey')) {
          // Remove drawer state from URL
          navigate(
            {
              pathname: location.pathname,
              query: {
                ...location.query,
                tagDrawerSort: undefined,
                tagDrawerKey: undefined,
              },
            },
            {replace: true}
          );
        }
      },
      shouldCloseOnInteractOutside: element => {
        const viewAllButton = openButtonRef.current;
        if (viewAllButton?.contains(element)) {
          return false;
        }
        return true;
      },
    });
  }, [location, navigate, drawer, project, groupId, openButtonRef]);

  return {openTagsDrawer};
}
