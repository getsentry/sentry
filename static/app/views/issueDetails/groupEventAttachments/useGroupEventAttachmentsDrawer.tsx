import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {GroupEventAttachmentsDrawer} from 'sentry/views/issueDetails/groupEventAttachments/groupEventAttachmentsDrawer';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function useGroupEventAttachmentsDrawer({
  project,
  group,
}: {
  group: Group;
  project: Project;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const drawer = useDrawer();
  const {baseUrl} = useGroupDetailsRoute();

  const openAttachmentDrawer = useCallback(() => {
    drawer.openDrawer(
      () => <GroupEventAttachmentsDrawer project={project} groupId={group.id} />,
      {
        ariaLabel: 'attachments drawer',
        onClose: () => {
          // Remove drawer state from URL
          navigate(
            {
              pathname: baseUrl,
              query: {
                ...location.query,
                attachmentFilter: undefined,
                cursor: undefined,
              },
            },
            {replace: true}
          );
        },
        shouldCloseOnInteractOutside: element => {
          // Prevent closing the drawer when deleting an attachment
          if (document.querySelector('[role="dialog"]')?.contains(element)) {
            return false;
          }

          return true;
        },
      }
    );
  }, [location, navigate, drawer, project, group, baseUrl]);

  return {openAttachmentDrawer};
}
