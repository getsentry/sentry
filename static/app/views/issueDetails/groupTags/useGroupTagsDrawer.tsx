import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {GroupTagsDrawer} from 'sentry/views/issueDetails/groupTags/groupTagsDrawer';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function useGroupTagsDrawer({group}: {group: Group}) {
  const location = useLocation();
  const navigate = useNavigate();
  const drawer = useDrawer();
  const {baseUrl} = useGroupDetailsRoute();

  const openTagsDrawer = useCallback(() => {
    drawer.openDrawer(() => <GroupTagsDrawer group={group} />, {
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
      shouldCloseOnLocationChange: newLocation => {
        return !newLocation.pathname.includes('/tags/');
      },
      transitionProps: {stiffness: 1000},
    });
  }, [location, navigate, drawer, group, baseUrl]);

  return {openTagsDrawer};
}
