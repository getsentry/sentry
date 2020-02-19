export const INSTALLED = 'Installed' as const;
export const NOT_INSTALLED = 'Not Installed' as const;
export const PENDING = 'Pending' as const;

export const colors = {
  [INSTALLED]: 'success',
  [NOT_INSTALLED]: 'gray2',
  [PENDING]: 'yellowOrange',
};

export const legacyIds = [
  'jira',
  'bitbucket',
  'github',
  'gitlab',
  'slack',
  'pagerduty',
  'clubhouse',
  'vsts',
];
