import {useCallback} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {GroupDistributionsDrawer} from 'sentry/views/issueDetails/groupDistributionsDrawer';
import {GroupIdProvider} from 'sentry/views/issueDetails/groupIdContext';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';

import {DISTRIBUTIONS_TYPE_QUERY_KEY} from './types';

/**
 * Shared tags and feature flags distributions drawer used by issue details.
 */
export function useGroupDistributionsDrawer({
  getReturnPath,
  group,
  includeFeatureFlagsTab,
}: {
  getReturnPath: () => string;
  group: Group;
  includeFeatureFlagsTab: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const {openDrawer} = useDrawer();

  const openDistributionsDrawer = useCallback(() => {
    openDrawer(
      () => (
        <GroupIdProvider groupId={group.id}>
          <GroupDistributionsDrawer
            group={group}
            includeFeatureFlagsTab={includeFeatureFlagsTab}
          />
        </GroupIdProvider>
      ),
      {
        ariaLabel: t('Distributions Drawer'),
        drawerKey: 'distributions-drawer',
        onClose: () => {
          navigate(
            {
              pathname: getReturnPath(),
              query: {
                ...location.query,
                tagDrawerCursor: undefined,
                tagDrawerSort: undefined,
                flagDrawerCursor: undefined,
                [DISTRIBUTIONS_TYPE_QUERY_KEY]: undefined,
              },
            },
            {preventScrollReset: true}
          );
        },
        shouldCloseOnLocationChange: newLocation => {
          return !newLocation.pathname.includes(`/${TabPaths[Tab.DISTRIBUTIONS]}`);
        },
      }
    );
  }, [location, navigate, openDrawer, group, getReturnPath, includeFeatureFlagsTab]);

  return {openDistributionsDrawer};
}
