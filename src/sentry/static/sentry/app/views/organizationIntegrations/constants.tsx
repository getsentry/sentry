export const INSTALLED = 'Installed' as const;
export const NOT_INSTALLED = 'Not Installed' as const;
export const PENDING = 'Pending' as const;

export const COLORS = {
  [INSTALLED]: 'success',
  [NOT_INSTALLED]: 'gray2',
  [PENDING]: 'yellowOrange',
} as const;

/**
 * Integrations in the integration directory should be sorted by their popularity (weight). The weights should reflect the relative popularity of each integration are hardcoded.
 */

export const POPULARITY_WEIGHT: {
  [key: string]: number;
} = {
  // First-party-integrations
  slack: 50,
  github: 20,
  jira: 10,
  bitbucket: 10,
  gitlab: 10,
  pagerduty: 10,
  vsts: 10,
  jira_server: 10,
  bitbucket_server: 10,
  github_enterprise: 10,

  // Sentry-apps
  clubhouse: 9,
  rookout: 9,
  clickup: 9,
  amixir: 9,
  split: 9,

  // Plugins
  webhooks: 10,
  asana: 8,
  trello: 8,
  heroku: 8,
  pivotal: 8,
  twilio: 8,
  pushover: 5,
  redmine: 5,
  phabricator: 5,
  opsgenie: 5,
  teamwork: 5,
  victorops: 5,
  sessionstack: 5,
  segment: 1,
  'amazon-sqs': 1,
  splunk: 1,
} as const;
