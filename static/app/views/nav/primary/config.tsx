import {t} from 'sentry/locale';
import {PrimaryNavGroup} from 'sentry/views/nav/types';

type PrimaryNavGroupConfig = Record<
  PrimaryNavGroup,
  {
    basePaths: string[];
    label: string;
  }
>;

export const PRIMARY_NAV_GROUP_CONFIG: PrimaryNavGroupConfig = {
  [PrimaryNavGroup.ISSUES]: {
    basePaths: ['issues'],
    label: t('Issues'),
  },
  [PrimaryNavGroup.EXPLORE]: {
    basePaths: ['explore'],
    label: t('Explore'),
  },
  [PrimaryNavGroup.DASHBOARDS]: {
    // XXX: Dashboard uses the singular `dashboard` path for details pages
    // but the plural `dashboards` path for the list of dashboards.
    basePaths: ['dashboards', 'dashboard'],
    label: t('Dashboards'),
  },
  [PrimaryNavGroup.INSIGHTS]: {
    basePaths: ['insights'],
    label: t('Insights'),
  },
  [PrimaryNavGroup.SETTINGS]: {
    basePaths: ['settings'],
    label: t('Settings'),
  },
  [PrimaryNavGroup.CODECOV]: {
    basePaths: ['codecov'],
    label: t('Prevent'),
  },
  [PrimaryNavGroup.ADMIN]: {
    basePaths: ['manage'],
    label: t('Admin'),
  },
};
