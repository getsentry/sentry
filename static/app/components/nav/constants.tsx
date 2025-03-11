import {PrimaryNavGroup} from 'sentry/components/nav/types';
import {t} from 'sentry/locale';

export const NAV_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY = 'navigation-sidebar-is-collapsed';

export const NAV_GROUP_LABELS: Record<PrimaryNavGroup, string> = {
  [PrimaryNavGroup.ISSUES]: t('Issues'),
  [PrimaryNavGroup.EXPLORE]: t('Explore'),
  [PrimaryNavGroup.DASHBOARDS]: t('Dashboards'),
  [PrimaryNavGroup.INSIGHTS]: t('Insights'),
  [PrimaryNavGroup.SETTINGS]: t('Settings'),
};

export const PRIMARY_SIDEBAR_WIDTH = 66;
export const SECONDARY_SIDEBAR_WIDTH = 190;
