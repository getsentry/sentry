import type {Feature} from 'getsentry/types';

export function FeatureListFixture(): Record<string, Feature> {
  return {
    ondemand: {
      name: 'On-Demand Events',
      description: 'Pay per-event if you exhaust your included monthly capacity',
    },
    'sso-basic': {
      name: 'Basic SSO',
      description: 'Single Sign-On via GitHub or Google.',
    },
    'sso-saml2': {
      name: 'Single Sign-on',
      description:
        'Single Sign-On via GitHub, Google, Rippling, or SAML (including Auth0, Okta, and OneLogin).',
    },
    'discard-groups': {
      name: 'Discard Issues',
      description:
        "Choose issues to delete and discard and avoid charges for data you don't need.",
    },
    'custom-inbound-filters': {
      name: 'Custom Filters',
      description:
        "Create custom inbound filters to discard events and avoid charges for data you don't need.",
    },
    'integrations-issue-basic': {
      name: 'Issue Linking',
      description: 'Create and Link issues on GitHub, Jira, Bitbucket, and more.',
    },
    'integrations-issue-sync': {
      name: 'Issue Syncing',
      description:
        'Automatic two-way syncing of assignment and comment forwarding on GitHub, Jira, Bitbucket, and more.',
    },
    'integrations-codeowners': {
      name: 'Code Owners',
      description:
        'Import your GitHub or GitLab CODEOWNERS file to start automatically assigning issues to the right people.',
    },
    'integrations-event-hooks': {
      name: 'Error Webhooks',
      description: 'Enables the error webhooks for the Integration Platform.',
    },
    'integrations-ticket-rules': {
      name: 'Ticket Rules',
      description:
        'Automatically create Issue Tracker tickets based on Issue Alert conditions.',
    },
    'integrations-stacktrace-link': {
      name: 'Stacktrace Linking',
      description: 'Link your stack trace to your source code.',
    },
    'rate-limits': {
      name: 'Custom Rate Limits',
      description:
        "Create custom rate limits per-key (within a project) to discard events and avoid charges for data you don't need.",
    },
    'data-forwarding': {
      name: 'Data Forwarding',
      description:
        'Automatically forward processed Sentry events into third party tools such as Amazon SQS, Segment, and Splunk.',
    },
    'weekly-reports': {
      name: 'Weekly Reports',
      description: "A weekly email summary of your organization's health.",
    },
    'discover-basic': {
      name: 'Discover',
      description: 'Browse raw event data outside of Issues.',
    },
    'discover-query': {
      name: 'Discover Query Builder',
      description: 'Build and save custom queries using Discover.',
    },
    'global-views': {
      name: 'Cross project visibility',
      description: 'View data across all projects in your organization.',
    },
    invoices: {
      name: 'Invoicing',
      description: 'Standard invoicing for your accounting department.',
    },
    baa: {
      name: 'BAA',
      description: 'A Business Associate Agreement to aid with your HIPAA compliance.',
    },
    'advanced-search': {
      name: 'Advanced Search',
      description:
        'Improved search features such as negative searching and wildcard matching.',
    },
    'custom-symbol-sources': {
      name: 'Custom Repositories',
      description:
        'Configure custom Symbol Servers, Amazon S3 buckets, or GCS buckets for debug files.',
    },
    relay: {
      name: 'Relay',
      description:
        'Use Relay as middle layer for on premise data scrubbing before sending data to Sentry.',
    },
    'app-store-connect-multiple': {
      name: 'Multiple App Store Connect apps',
      description: 'Add multiple Apple App Store Connect apps per project',
    },
  };
}
