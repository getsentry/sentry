import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {GroupTagsDrawer} from 'sentry/views/issueDetails/groupTags/groupTagsDrawer';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

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
  const {baseUrl} = useGroupDetailsRoute();

  const openTagsDrawer = useCallback(() => {
    drawer.openDrawer(
      () => <GroupTagsDrawer projectSlug={projectSlug} groupId={groupId} />,
      {
        ariaLabel: t('Tags Drawer'),
        onClose: () => {
          navigate(
            {
              pathname: baseUrl,
              query: {
                ...location.query,
                tagDrawerSort: undefined,
              },
            },
            {replace: true}
          );
        },
        shouldCloseOnLocationChange: newPathname => {
          return !newPathname.includes('/tags/');
        },
      }
    );
  }, [location, navigate, drawer, projectSlug, groupId, baseUrl]);

  return {openTagsDrawer};
}
