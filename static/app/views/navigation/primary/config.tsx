export enum PrimaryNavigationGroup {
  ISSUES = 'issues',
  DASHBOARDS = 'dashboards',
  EXPLORE = 'explore',
  INSIGHTS = 'insights',
  MONITORS = 'monitors',
  SETTINGS = 'settings',
  PREVENT = 'prevent',
  ADMIN = 'admin',
}

type PrimaryNavigationGroupConfig = Record<PrimaryNavigationGroup, string[]>;

export const PRIMARY_NAVIGATION_GROUP_CONFIG: PrimaryNavigationGroupConfig = {
  [PrimaryNavigationGroup.ISSUES]: ['issues'],
  [PrimaryNavigationGroup.EXPLORE]: ['explore'],
  // XXX: Dashboard uses the singular `dashboard` path for details pages
  // but the plural `dashboards` path for the list of dashboards
  [PrimaryNavigationGroup.DASHBOARDS]: ['dashboards', 'dashboard'],
  [PrimaryNavigationGroup.INSIGHTS]: ['insights'],
  [PrimaryNavigationGroup.MONITORS]: ['monitors'],
  [PrimaryNavigationGroup.SETTINGS]: ['settings'],
  [PrimaryNavigationGroup.PREVENT]: ['prevent'],
  [PrimaryNavigationGroup.ADMIN]: ['manage'],
};
