import {t} from 'app/locale';
import {Dataset, EventTypes} from 'app/views/settings/incidentRules/types';

export type AlertType =
  | 'issues'
  | 'num_errors'
  | 'users_experiencing_errors'
  | 'throughput'
  | 'trans_duration'
  | 'apdex'
  | 'failure_rate'
  | 'lcp'
  | 'fid'
  | 'cls'
  | 'fp'
  | 'fcp'
  | 'ttfb';

export const AlertWizardAlertNames: Record<AlertType, string> = {
  issues: t('Issues'),
  num_errors: t('Number of Errors'),
  users_experiencing_errors: t('Users Experiencing Errors'),
  throughput: t('Throughput'),
  trans_duration: t('Transaction Duration'),
  apdex: t('Apdex'),
  failure_rate: t('Failure Rate'),
  lcp: t('Longest Contentful Paint'),
  fid: t('First Input Delay'),
  cls: t('Cumulative Layout Shift'),
  fp: t('First Paint'),
  fcp: t('First Contentful Paint'),
  ttfb: t('Time to First Byte'),
};

export const AlertWizardOptions: {
  categoryHeading: string;
  options: AlertType[];
}[] = [
  {
    categoryHeading: t('Errors'),
    options: ['issues', 'num_errors', 'users_experiencing_errors'],
  },
  {
    categoryHeading: t('Performance'),
    options: [
      'throughput',
      'trans_duration',
      'apdex',
      'failure_rate',
      'lcp',
      'fid',
      'cls',
      'fp',
      'fcp',
      'ttfb',
    ],
  },
];

type PanelContent = {
  description: string;
  docsLink?: string;
  examples: string[];
  illustration?: string;
};

export const AlertWizardPanelContent: Record<AlertType, PanelContent> = {
  issues: {
    description: t(
      'Issues are groups of errors that have a similar stacktrace. You can set an alert for new issues, issue state changes, and frequency of errors or users affected by an issue.'
    ),
    examples: [
      t("When the triggering event's attribute X, send an email to a team."),
      t('When an issue was seen 100 times in the last 2 days, send Slack notification.'),
      t(
        'When an issue changes state from resolved to unresolved and is assigned to member X, create a Jira ticket.'
      ),
    ],
  },
  num_errors: {
    description: t(
      'Alert when the number of errors in a project matching your filters crosses a threshold. This is useful for monitoring the overall level or errors in your project or errors occurring in specific parts of your app.'
    ),
    examples: [
      t('When the checkout page has more than 10k errors, email a user.'),
      t(
        'Send an email to a team when errors exceed 500k on parts of the codebase they own.'
      ),
      t('Notify a Slack channel when there are no errors at all.'),
    ],
  },
  users_experiencing_errors: {
    description: t(
      'Alert when the number of users affected by errors in your project crosses a threshold.'
    ),
    examples: [
      t('When 100k users experience an error, send a notification to a Slack channel.'),
      t(
        'Send an email to team when 100 users experience a problem on the Checkout page.'
      ),
    ],
  },
  throughput: {
    description: t(
      'Alert when the number of transactions crosses a threshold within a configurable time window.'
    ),
    examples: [
      t(
        'When total transactions across your app reaches 100k, send an alert to a team via Microsoft Teams.'
      ),
      t(
        'When the latest release reaches 1.5m transactions, send an email to the oncall member.'
      ),
    ],
  },
  trans_duration: {
    description: t(
      'Monitor how long it takes for transactions to complete. Use flexible aggregates like percentiles, averages, and min/max.'
    ),
    examples: [
      t(
        'When any transaction slower than 3 seconds occurs, create a Jira issue and assign it to a team.'
      ),
      t(
        'When there’s no transaction slower than 250ms, send an alert to a Slack channel.'
      ),
    ],
  },
  apdex: {
    description: t(
      'Apdex is an industry-standard metric used to track and measure user satisfaction based on your application response times. The Apdex score provides the ratio of satisfactory, tolerable, and frustrated requests in a specific transaction or endpoint. This metric provides a standard for you to compare transaction performance, understand which ones may require additional optimization or investigation, and set targets or goals for performance.'
    ),
    examples: [t('When apdex is beneath 300, send an email to everyone on the team.')],
  },
  failure_rate: {
    description: t(
      'Alert when the percentage of unsuccessful transactions reaches a threshold.'
    ),
    examples: [
      t('When the failure rate reaches 10%, send a notification to a Slack channel.'),
    ],
  },
  lcp: {
    description: t(
      'Largest Contentful Paint (LCP) measures loading performance. Specifically, it marks the point when the largest image or text block is visible within the viewport. A fast LCP helps reassure the user that the page is useful, and we recommend LCP is less than 2.5 seconds.'
    ),
    examples: [
      t(
        'When an LCP of more than 2.5s is detected on any key transaction, send an email to a team.'
      ),
    ],
    docsLink: 'https://docs.sentry.io/product/performance/web-vitals',
  },
  fid: {
    description: t(
      'First Input Delay (FID) measures interactivity as the response time when the user tries to interact with the viewport. A low FID helps ensure that a page is useful, and recommend it be less than 100 milliseconds.'
    ),
    examples: [
      t(
        'When first input delay is longer than 4s, send notification to a Slack channel.'
      ),
    ],
    docsLink: 'https://docs.sentry.io/product/performance/web-vitals',
  },
  cls: {
    description: t(
      'Cumulative Layout Shift (CLS) measures visual stability by quantifying unexpected layout shifts that occur during the entire lifespan of the page. A CLS of less than 0.1 is a good user experience, while anything greater than 0.25 is poor.'
    ),
    examples: [
      t(
        'When cumulative layout shift is greater than 0.5 on the Checkout page, send an email to all members of a team.'
      ),
    ],
    docsLink: 'https://docs.sentry.io/product/performance/web-vitals',
  },
  fp: {
    description: t(
      'First Paint (FP), like Largest Contentful Paint (LCP), measures loading performance. Specifically, it marks the point when the first pixel renders on the screen. We recommend an FP of less than 500 milliseconds.'
    ),
    examples: [
      t(
        'When first paint takes longer than 250ms, create a Jira ticket and assign it to a team.'
      ),
    ],
    docsLink: 'https://docs.sentry.io/product/performance/web-vitals',
  },
  fcp: {
    description: t(
      'First Contentful Paint (FCP), like Largest Contentful Paint (LCP), measures loading performance. Specifically, it marks the point when content such as text and images can first be seen on a page.'
    ),
    examples: [
      t(
        'When first contentful paint of a specific page is above 0.25, send an email to the team.'
      ),
    ],
    docsLink: 'https://docs.sentry.io/product/performance/web-vitals',
  },
  ttfb: {
    description: t(
      "Measures the time it takes for a user's browser to receive the first byte of page content. This includes time spent on DNS lookup, connection negotiation, network latency, and unloading the previous document."
    ),
    examples: [
      t(
        'When the time to first byte is above 600ms, send a notification to a Slack channel.'
      ),
    ],
    docsLink: 'https://docs.sentry.io/product/performance/web-vitals',
  },
};

export type WizardRuleTemplate = {
  aggregate: string;
  dataset: Dataset;
  eventTypes: EventTypes;
};

export const AlertWizardRuleTemplates: Record<
  Exclude<AlertType, 'issues'>,
  WizardRuleTemplate
> = {
  num_errors: {
    aggregate: 'count()',
    dataset: Dataset.ERRORS,
    eventTypes: EventTypes.ERROR,
  },
  users_experiencing_errors: {
    aggregate: 'count_unique(tags[sentry:user])',
    dataset: Dataset.ERRORS,
    eventTypes: EventTypes.ERROR,
  },
  throughput: {
    aggregate: 'count()',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  trans_duration: {
    aggregate: 'p95(transaction.duration)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  apdex: {
    aggregate: 'apdex(300)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  failure_rate: {
    aggregate: 'failure_rate()',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  lcp: {
    aggregate: 'p95(measurements.lcp)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  fid: {
    aggregate: 'p95(measurements.fid)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  cls: {
    aggregate: 'p95(measurements.cls)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  fp: {
    aggregate: 'p95(measurements.fp)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  fcp: {
    aggregate: 'p95(measurements.fcp)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  ttfb: {
    aggregate: 'p95(measurements.ttfb)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
};
