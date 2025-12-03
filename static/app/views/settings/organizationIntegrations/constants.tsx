export const INSTALLED = 'Installed';
export const NOT_INSTALLED = 'Not Installed';
export const PENDING = 'Pending';
export const DISABLED = 'Disabled';
export const PENDING_DELETION = 'Pending Deletion';

/**
 * Integrations in the integration directory should be sorted by their popularity (weight).
 * The weights should reflect the relative popularity of each integration are hardcoded, except for
 * Sentry-apps which read popularity from the db.
 */

export const POPULARITY_WEIGHT: Record<string, number> = {
  // First-party-integrations
  slack: 50,
  github: 20,
  jira: 15,
  bitbucket: 10,
  discord: 15,
  gitlab: 10,
  pagerduty: 10,
  vsts: 9,
  jira_server: 9,
  bitbucket_server: 9,
  github_enterprise: 10,
  vercel: 15,
  msteams: 15,
  aws_lambda: 10,
  cursor: 14,

  // Plugins
  webhooks: 10,
  asana: 8,
  trello: 8,
  heroku: 8,
  pivotal: 8,
  twilio: 8,
  pushover: 5,
  redmine: 5,
  opsgenie: 5,
  victorops: 5,
  sessionstack: 5,
  segment: 2,
  'amazon-sqs': 2,
  splunk: 2,
} as const;
