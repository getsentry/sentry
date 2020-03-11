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
  slack: 25606,
  github: 15161,
  webhooks: 15131,
  jira: 12875,
  bitbucket: 11070,
  trello: 10938,
  heroku: 10904,
  gitlab: 10731,
  twilio: 9149,
  pivotal: 8734,
  pagerduty: 8675,
  campfire: 8667,
  irc: 8564,
  pushover: 8403,
  redmine: 8322,
  phabricator: 8303,
  flowdock: 8252,
  opsgenie: 7913,
  teamwork: 7288,
  youtrack: 6746,
  asana: 6436,
  victorops: 5234,
  sessionstack: 4084,
  vsts: 2089,
  segment: 440,
  clubhouse: 957,
  'amazon-sqs': 217,
  splunk: 134,
  rookout: 72,
  clickup: 272,
  amixir: 23,
  split: 18,
};
