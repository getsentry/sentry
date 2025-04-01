import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {GroupDistributionsDrawer} from 'sentry/views/issueDetails/groupDistributionsDrawer';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

/**
 * Shared tags and feature flags distributions drawer, used by streamlined issue details UI.
 */
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
        ariaLabel: t('Distributions Drawer'),
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
          return !newLocation.pathname.includes(`/${TabPaths[Tab.DISTRIBUTIONS]}`);
        },
      }
    );
  }, [location, navigate, openDrawer, group, baseUrl, includeFeatureFlagsTab]);

  return {openDistributionsDrawer};
}
