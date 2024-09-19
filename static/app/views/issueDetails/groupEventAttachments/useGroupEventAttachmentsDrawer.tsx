import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {GroupEventAttachmentsDrawer} from 'sentry/views/issueDetails/groupEventAttachments/groupEventAttachmentsDrawer';

export function useGroupEventAttachmentsDrawer({
  project,
  group,
  openButtonRef,
}: {
  group: Group;
  openButtonRef: React.RefObject<HTMLButtonElement>;
  project: Project;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const drawer = useDrawer();

  const openAttachmentDrawer = useCallback(() => {
    drawer.openDrawer(
      () => <GroupEventAttachmentsDrawer project={project} groupId={group.id} />,
      {
        ariaLabel: 'attachments drawer',
        onClose: () => {
          if (location.query.attachmentFilter || location.query.cursor) {
            // Remove drawer state from URL
            navigate({
              pathname: location.pathname,
              query: {
                ...location.query,
                attachmentFilter: undefined,
                cursor: undefined,
              },
            });
          }
        },
        shouldCloseOnInteractOutside: element => {
          // Prevent closing the drawer when deleting an attachment
          if (document.querySelector('[role="dialog"]')?.contains(element)) {
            return false;
          }

          // Prevent closing the drawer when clicking the button that opens it
          const viewAllButton = openButtonRef.current;
          if (viewAllButton?.contains(element)) {
            return false;
          }
          return true;
        },
      }
    );
  }, [location, navigate, drawer, project, group, openButtonRef]);

  return {openAttachmentDrawer};
}
