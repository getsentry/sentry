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

export const PRIMARY_NAV_GROUP_PATHS: Record<PrimaryNavGroup, string> = {
  [PrimaryNavGroup.ISSUES]: 'issues',
  [PrimaryNavGroup.EXPLORE]: 'explore',
  [PrimaryNavGroup.DASHBOARDS]: 'dashboards',
  [PrimaryNavGroup.INSIGHTS]: 'insights',
  [PrimaryNavGroup.SETTINGS]: 'settings',
  [PrimaryNavGroup.PIPELINE]: 'pipeline',
};

export const PRIMARY_SIDEBAR_WIDTH = 66;
export const SECONDARY_SIDEBAR_WIDTH = 190;
