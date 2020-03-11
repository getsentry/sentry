export const INSTALLED = 'Installed' as const;
export const NOT_INSTALLED = 'Not Installed' as const;
export const PENDING = 'Pending' as const;

export const colors = {
  [INSTALLED]: 'success',
  [NOT_INSTALLED]: 'gray2',
  [PENDING]: 'yellowOrange',
};

/**
 * Integrations in the integration directory should be sorted by their popularity (weight).
 * These weights should be hardcoded in the application itself.
 * We can store this in a map where the key is the integration slug and the value is an integer and represents the weight.
 * The weights should reflect the relative popularity of each integration.
 */

export const popularityWeights = {
  slack: 10,
  splunk: 3,
  webhooks: 100,
  bitbucket_server: 30,
};
