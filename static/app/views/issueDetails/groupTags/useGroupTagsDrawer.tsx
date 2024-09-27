import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {GroupTagsDrawer} from 'sentry/views/issueDetails/groupTags/groupTagsDrawer';

export function useGroupTagsDrawer({
  groupId,
  projectSlug,
}: {
  groupId: string;
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
          navigate({
            // Either /issue/:groupId/ or /group/:groupId/events/:eventId/
            pathname: location.pathname.split('/tags/')[0],
            query: {
              ...location.query,
              tagDrawerSort: undefined,
            },
          });
        },
        shouldCloseOnLocationChange: false,
      }
    );
  }, [location, navigate, drawer, projectSlug, groupId]);

  return {openTagsDrawer};
}
