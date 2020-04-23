import {DocumentIntegration} from 'app/types';

export const INSTALLED = 'Installed' as const;
export const NOT_INSTALLED = 'Not Installed' as const;
export const PENDING = 'Pending' as const;
export const LEARN_MORE = 'Learn More' as const;

export const COLORS = {
  [INSTALLED]: 'success',
  [NOT_INSTALLED]: 'gray2',
  [PENDING]: 'yellowOrange',
  [LEARN_MORE]: 'gray2',
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

  //doc integrations
  fullstory: 8,
  datadog: 8,
  msteams: 8,
  asayer: 8,
  rocketchat: 8,
} as const;

export const documentIntegrations: {
  [key: string]: DocumentIntegration;
} = {
  fullstory: {
    slug: 'fullstory',
    name: 'FullStory',
    author: 'Sentry',
    docUrl: 'https://www.npmjs.com/package/@sentry/fullstory',
    description:
      'The Sentry-FullStory integration seamlessly integrates the Sentry and FullStory platforms. When you look at a browser error in Sentry, you will see a link to the FullStory session replay at that exact moment in time. When you are watching a FullStory replay and your user experiences an error, you will see a link that will take you to that error in Sentry.',
    features: [
      {
        featureGate: 'session-replay',
        description:
          'Links Sentry errors to the FullStory session replay and vice-versa.',
      },
    ],
    resourceLinks: [
      {
        title: 'Documentation',
        url: 'https://www.npmjs.com/package/@sentry/fullstory',
      },
      {title: 'View Source', url: 'https://github.com/getsentry/sentry-fullstory'},
      {
        title: 'Report Issue',
        url: 'https://github.com/getsentry/sentry-fullstory/issues',
      },
    ],
  },
  datadog: {
    slug: 'datadog',
    name: 'Datadog',
    author: 'Datadog',
    docUrl: 'https://docs.datadoghq.com/integrations/sentry/',
    description:
      'Quickly discover relationships between production apps and systems performance. See correlations between Sentry events and metrics from infra services like AWS, Elasticsearch, Docker, and Kafka can save time detecting sources of future spikes.',
    features: [
      {
        featureGate: 'incident-management',
        description:
          'Manage incidents and outages by sending Sentry notifications to DataDog.',
      },
      {
        featureGate: 'alert-rule',
        description:
          'Configure Sentry rules to trigger notifications based on conditions you set through the Sentry webhook integration.',
      },
    ],
    resourceLinks: [
      {title: 'Documentation', url: 'https://docs.datadoghq.com/integrations/sentry/'},
    ],
  },
  msteams: {
    slug: 'msteams',
    name: 'Microsoft Teams',
    author: 'Microsoft',
    docUrl:
      'https://appsource.microsoft.com/en-us/product/office/WA104381566?src=office&tab=Overview',
    description:
      "Microsoft Teams is a hub for teamwork in Office 365. Keep all your team's chats, meetings, files, and apps together in one place.",
    features: [
      {
        featureGate: 'chat',
        description: 'Get Sentry notifications in Microsoft Teams.',
      },
      {
        featureGate: 'alert-rule',
        description:
          'Configure Sentry rules to trigger notifications based on conditions you set through the Sentry webhook integration.',
      },
    ],
    resourceLinks: [
      {
        title: 'Documentation',
        url:
          'https://appsource.microsoft.com/en-us/product/office/WA104381566?src=office&tab=Overview',
      },
    ],
  },
  asayer: {
    slug: 'asayer',
    name: 'Asayer',
    author: 'Sentry',
    docUrl: 'https://docs.asayer.io/integrations/sentry',
    description:
      'Asayer is a session replay tool for developers. Replay each user session alongside your front/backend logs and other data spread across your stack so you can immediately find, reproduce and fix bugs faster.',
    features: [
      {
        featureGate: 'session-replay',
        description:
          'By integrating Sentry with Asayer, you can see the moments that precede and that lead up to each problem. You can sync your Sentry logs alongside your session replay, JS console and network activity to gain complete visibility over every issue that affect your users.',
      },
    ],
    resourceLinks: [
      {title: 'Documentation', url: 'https://docs.asayer.io/integrations/sentry'},
    ],
  },
  rocketchat: {
    slug: 'rocketchat',
    name: 'Rocket.Chat',
    author: 'Rocket.Chat',
    docUrl: 'https://rocket.chat/docs/administrator-guides/integrations/sentry/',
    description:
      'Rocket.Chat is a free and open-source team chat collaboration platform that allows users to communicate securely in real-time across devices on the web, desktop or mobile and to customize their interface with a range of plugins, themes, and integrations with other key software.',
    features: [
      {
        featureGate: 'chat',
        description: 'Get Sentry notifications in Rocket.Chat.',
      },
      {
        featureGate: 'alert-rule',
        description:
          'Configure Sentry rules to trigger notifications based on conditions you set through the Sentry webhook integration.',
      },
    ],
    resourceLinks: [
      {
        title: 'Documentation',
        url: 'https://rocket.chat/docs/administrator-guides/integrations/sentry/',
      },
    ],
  },
};
