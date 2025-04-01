import {t} from 'sentry/locale';
import {PrimaryNavGroup} from 'sentry/views/nav/types';

export const NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY = 'navigation-sidebar-is-collapsed';

export const NAV_GROUP_LABELS: Record<PrimaryNavGroup, string> = {
  [PrimaryNavGroup.ISSUES]: t('Issues'),
  [PrimaryNavGroup.EXPLORE]: t('Explore'),
  [PrimaryNavGroup.DASHBOARDS]: t('Dashboards'),
  [PrimaryNavGroup.INSIGHTS]: t('Insights'),
  [PrimaryNavGroup.SETTINGS]: t('Settings'),
  [PrimaryNavGroup.PIPELINE]: t('Pipeline'),
};

export const PRIMARY_NAV_GROUP_PATHS = {
  [PrimaryNavGroup.ISSUES]: 'issues' as const,
  [PrimaryNavGroup.EXPLORE]: 'explore' as const,
  [PrimaryNavGroup.DASHBOARDS]: 'dashboards' as const,
  [PrimaryNavGroup.INSIGHTS]: 'insights' as const,
  [PrimaryNavGroup.SETTINGS]: 'settings' as const,
  [PrimaryNavGroup.PIPELINE]: 'pipeline' as const,
} satisfies Record<PrimaryNavGroup, string>;

export const PRIMARY_SIDEBAR_WIDTH = 66;
export const SECONDARY_SIDEBAR_WIDTH = 190;
