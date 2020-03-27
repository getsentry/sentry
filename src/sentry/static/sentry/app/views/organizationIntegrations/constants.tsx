import {DocumentIntegration} from 'app/types';

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
  amixr: 9,
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
  segment: 2,
  'amazon-sqs': 2,
  splunk: 2,
} as const;

export const documentIntegrations: {
  [key: string]: DocumentIntegration;
} = {
  datadog: {
    slug: 'datadog',
    name: 'Datadog',
    author: 'Datadog',
    docUrl: 'https://www.datadoghq.com/',
    description:
      'Quickly discover relationships between production apps and systems performance. Seeing correlations between Sentry events and metrics from infra services like AWS, Elasticsearch, Docker, and Kafka can save time detecting sources of future spikes.',
    features: [
      {
        featureGate: 'data-forwarding',
        description: 'Forward any events you choose from Sentry.',
      },
    ],
    resourceLinks: [
      {title: 'View Source', url: 'https://sentry.io'},
      {title: 'Report Issue', url: 'https://github.com'},
    ],
  },
};
