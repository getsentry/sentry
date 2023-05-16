import {t} from 'sentry/locale';

export const ERROR_CODE_DESCRIPTIONS = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

export const EXTERNAL_APIS = {
  stripe: {
    statusPage: 'https://status.stripe.com/',
    faviconLink: 'https://stripe.com/favicon.ico',
    description: t(
      'Stripe is a suite of payment APIs that powers commerce for online businesses of all sizes'
    ),
  },
  twilio: {
    statusPage: 'https://status.twilio.com/',
    faviconLink: 'https://www.twilio.com/favicon.ico',
    description: t('Twilio is a cloud communications platform as a service company.'),
  },
  sendgrid: {
    statusPage: 'https://status.sendgrid.com/',
    faviconLink: 'https://sendgrid.com/favicon.ico',
    description: t(
      'SendGrid is a cloud-based SMTP provider that allows you to send email without having to maintain email servers.'
    ),
  },
  plaid: {
    statusPage: 'https://status.plaid.com/',
    faviconLink: 'https://plaid.com/favicon.ico',
    description: t(
      'Plaid is a technology platform that enables applications to connect with users bank accounts.'
    ),
  },
  paypal: {statusPage: 'https://www.paypal-status.com/'},
  braintree: {statusPage: 'https://status.braintreepayments.com/'},
  clickup: {
    statusPage: 'https://clickup.statuspage.io/',
    faviconLink: 'https://clickup.com/favicon.ico',
    description: t(
      'ClickUp is a productivity platform that provides a fundamentally new way to work.'
    ),
  },
  github: {
    statusPage: 'https://www.githubstatus.com/',
    faviconLink: 'https://github.com/favicon.ico',
    description: t(
      'GitHub is a provider of Internet hosting for software development and version control.'
    ),
  },
  gitlab: {
    statusPage: 'https://status.gitlab.com/',
    faviconLink: 'https://gitlab.com/favicon.ico',
    description: t(
      'GitLab is a web-based DevOps lifecycle tool that provides a Git-repository manager providing wiki, issue-tracking and CI/CD pipeline features.'
    ),
  },
  bitbucket: {
    statusPage: 'https://bitbucket.status.atlassian.com/',
    faviconLink: 'https://bitbucket.org/favicon.ico',
    description: t(
      'Bitbucket is a web-based version control repository hosting service.'
    ),
  },
  jira: {
    statusPage: 'https://jira.status.atlassian.com/',
    faviconLink: 'https://jira.com/favicon.ico',
    description: t(
      'Jira is a proprietary issue tracking product developed by Atlassian.'
    ),
  },
  asana: {
    statusPage: 'https://trust.asana.com/',
    faviconLink: 'https://asana.com/favicon.ico',
    description: t(
      'Asana is a web and mobile application designed to help teams organize, track, and manage their work.'
    ),
  },
  trello: {statusPage: 'https://trello.status.atlassian.com/'},
  zendesk: {statusPage: 'https://status.zendesk.com/'},
  intercom: {statusPage: 'https://www.intercomstatus.com/'},
  freshdesk: {statusPage: 'https://status.freshdesk.com/'},
  linear: {statusPage: 'https://status.linear.app/'},
  gaussMoney: {},
};

export const INTERNAL_API_REGEX = /\d\.\d|localhost/;
