import {t} from 'sentry/locale';
import {PrimaryNavigationGroup} from 'sentry/views/navigation/types';

type PrimaryNavigationGroupConfig = Record<
  PrimaryNavigationGroup,
  {
    basePaths: string[];
    label: string;
  }
>;

export const PRIMARY_NAVIGATION_GROUP_CONFIG: PrimaryNavigationGroupConfig = {
  [PrimaryNavigationGroup.ISSUES]: {
    basePaths: ['issues'],
    label: t('Issues'),
  },
  [PrimaryNavigationGroup.EXPLORE]: {
    basePaths: ['explore'],
    label: t('Explore'),
  },
  [PrimaryNavigationGroup.DASHBOARDS]: {
    // XXX: Dashboard uses the singular `dashboard` path for details pages
    // but the plural `dashboards` path for the list of dashboards.
    basePaths: ['dashboards', 'dashboard'],
    label: t('Dashboards'),
  },
  [PrimaryNavigationGroup.INSIGHTS]: {
    basePaths: ['insights'],
    label: t('Insights'),
  },
  [PrimaryNavigationGroup.MONITORS]: {
    basePaths: ['monitors'],
    label: t('Monitors'),
  },
  [PrimaryNavigationGroup.SETTINGS]: {
    basePaths: ['settings'],
    label: t('Settings'),
  },
  [PrimaryNavigationGroup.PREVENT]: {
    basePaths: ['prevent'],
    label: t('Prevent'),
  },
  [PrimaryNavigationGroup.ADMIN]: {
    basePaths: ['manage'],
    label: t('Admin'),
  },
};
