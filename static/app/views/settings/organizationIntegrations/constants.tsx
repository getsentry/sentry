export const INSTALLED = 'Installed';
export const NOT_INSTALLED = 'Not Installed';
export const PENDING = 'Pending';
export const DISABLED = 'Disabled';
export const PENDING_DELETION = 'Pending Deletion';
export const LEARN_MORE = 'Learn More';

export const COLORS = {
  [INSTALLED]: 'success',
  [NOT_INSTALLED]: 'gray300',
  [DISABLED]: 'gray300',
  [PENDING_DELETION]: 'gray300',
  [PENDING]: 'pink300',
  [LEARN_MORE]: 'gray300',
} as const;

/**
 * Integrations in the integration directory should be sorted by their popularity (weight).
 * The weights should reflect the relative popularity of each integration are hardcoded, except for
 * Sentry-apps which read popularity from the db.
 */

export const POPULARITY_WEIGHT: {
  [key: string]: number;
} = {
  // First-party-integrations
  slack: 50,
  github: 20,
  jira: 10,
  bitbucket: 10,
  discord: 10,
  gitlab: 10,
  pagerduty: 10,
  vsts: 10,
  jira_server: 10,
  bitbucket_server: 10,
  github_enterprise: 10,
  vercel: 10,
  msteams: 10,
  aws_lambda: 10,

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
  victorops: 5,
  sessionstack: 5,
  segment: 2,
  'amazon-sqs': 2,
  splunk: 2,
} as const;
