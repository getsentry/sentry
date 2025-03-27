import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {GroupDistributionsDrawer} from 'sentry/views/issueDetails/groupDistributionsDrawer';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function useGroupDistributionsDrawer({
  group,
  includeFeatureFlagsTab,
}: {
  group: Group;
  includeFeatureFlagsTab: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const {openDrawer} = useDrawer();
  const {baseUrl} = useGroupDetailsRoute();

  const openDistributionsDrawer = useCallback(() => {
    openDrawer(
      () => (
        <GroupDistributionsDrawer
          group={group}
          includeFeatureFlagsTab={includeFeatureFlagsTab}
        />
      ),
      {
        ariaLabel: t('Tags Drawer'),
        onClose: () => {
          navigate(
            {
              pathname: baseUrl,
              query: {
                ...location.query,
                tagDrawerSort: undefined,
                tab: undefined,
                flagDrawerCursor: undefined,
              },
            },
            {replace: true}
          );
        },
        shouldCloseOnLocationChange: newLocation => {
          return !newLocation.pathname.includes('/tags/');
        },
      }
    );
  }, [location, navigate, openDrawer, group, baseUrl, includeFeatureFlagsTab]);

  return {openDistributionsDrawer};
}
