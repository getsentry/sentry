import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import GroupFeatureFlagsDrawer from 'sentry/views/issueDetails/groupFeatureFlags/groupFeatureFlagsDrawer';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function useGroupFeatureFlagsDrawer({
  group,
  includeTagsTab,
  enabled = true,
}: {
  group: Group;
  includeTagsTab: boolean;
  enabled?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const {openDrawer} = useDrawer();
  const {baseUrl} = useGroupDetailsRoute();

  const openFeatureFlagsDrawer = useCallback(() => {
    if (!enabled) {
      navigate(
        {
          pathname: baseUrl,
          query: {
            ...location.query,
          },
        },
        {replace: true}
      );
    }

    openDrawer(
      () => <GroupFeatureFlagsDrawer group={group} includeTagsTab={includeTagsTab} />,
      {
        ariaLabel: t('Feature Flags Drawer'),
        onClose: () => {
          navigate(
            {
              pathname: baseUrl,
              query: {
                ...location.query,
              },
            },
            {replace: true}
          );
        },
        shouldCloseOnLocationChange: newLocation => {
          return !newLocation.pathname.includes(`/${TabPaths[Tab.FEATURE_FLAGS]}`);
        },
      }
    );
  }, [location, navigate, openDrawer, group, baseUrl, includeTagsTab, enabled]);

  return {openFeatureFlagsDrawer};
}
