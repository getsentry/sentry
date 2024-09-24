import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {GroupTagsDrawer} from 'sentry/views/issueDetails/groupTags/groupTagsDrawer';

export function useGroupTagsDrawer({
  groupId,
  projectSlug,
  openButtonRef,
}: {
  groupId: string;
  openButtonRef: React.RefObject<HTMLButtonElement>;
  projectSlug: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const drawer = useDrawer();

  const openTagsDrawer = useCallback(() => {
    drawer.openDrawer(
      () => <GroupTagsDrawer projectSlug={projectSlug} groupId={groupId} />,
      {
        ariaLabel: t('Tags Drawer'),
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
      }
    );
  }, [location, navigate, drawer, projectSlug, groupId, openButtonRef]);

  return {openTagsDrawer};
}
