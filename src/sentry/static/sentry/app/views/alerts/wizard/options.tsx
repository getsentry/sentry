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
  | 'fcp'
  | 'custom';

export const WebVitalAlertTypes = new Set(['lcp', 'fid', 'cls', 'fcp']);

export const AlertWizardAlertNames: Record<AlertType, string> = {
  issues: t('Issues'),
  num_errors: t('Number of Errors'),
  users_experiencing_errors: t('Users Experiencing Errors'),
  throughput: t('Throughput'),
  trans_duration: t('Transaction Duration'),
  apdex: t('Apdex'),
  failure_rate: t('Failure Rate'),
  lcp: t('Largest Contentful Paint'),
  fid: t('First Input Delay'),
  cls: t('Cumulative Layout Shift'),
  fcp: t('First Contentful Paint'),
  custom: t('Custom Metric'),
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
      'fcp',
      'custom',
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
      t("When the triggering event's level is fatal."),
      t('When an issue was seen 100 times in the last 2 days.'),
      t(
        'Create a JIRA ticket when an issue changes state from resolved to unresolved and is unassigned.'
      ),
    ],
  },
  num_errors: {
    description: t(
      'Alert when the number of errors in a project matching your filters crosses a threshold. This is useful for monitoring the overall level or errors in your project or errors occurring in specific parts of your app.'
    ),
    examples: [
      t('When the signup page has more than 10k errors in 5 minutes.'),
      t('When there are more than 500k errors in 10 minutes from a specific file.'),
    ],
  },
  users_experiencing_errors: {
    description: t(
      'Alert when the number of users affected by errors in your project crosses a threshold.'
    ),
    examples: [
      t('When 100k users experience an error in 1 hour.'),
      t('When 100 users experience a problem on the Checkout page.'),
    ],
  },
  throughput: {
    description: t('Throughput is the number of transactions in a period of time.'),
    examples: [
      t('When number of transactions on a key page exceeds 100k per minute.'),
      t('When number of transactions drops below a threshold.'),
    ],
  },
  trans_duration: {
    description: t(
      'Monitor how long it takes for transactions to complete. Use flexible aggregates like percentiles, averages, and min/max.'
    ),
    examples: [
      t('When any transaction is slower than 3 seconds.'),
      t('When the 75th percentile response time is higher than 250 milliseconds.'),
    ],
  },
  apdex: {
    description: t(
      'Apdex is a metric used to track and measure user satisfaction based on your application response times. The Apdex score provides the ratio of satisfactory, tolerable, and frustrated requests in a specific transaction or endpoint.'
    ),
    examples: [t('When apdex is below 300.')],
    docsLink: 'https://docs.sentry.io/product/performance/metrics/#apdex',
  },
  failure_rate: {
    description: t('Failure rate is the percentage of unsuccessful transactions.'),
    examples: [t('When the failure rate for an important endpoint reaches 10%.')],
    docsLink: 'https://docs.sentry.io/product/performance/metrics/#failure-rate',
  },
  lcp: {
    description: t(
      'Largest Contentful Paint (LCP) measures loading performance. Specifically, it marks the point when the largest image or text block is visible within the viewport. A fast LCP helps reassure the user that the page is useful, and we recommend LCP is less than 2.5 seconds.'
    ),
    examples: [
      t('When the 75th percentile LCP of your homepage is longer than 2.5 seconds.'),
    ],
    docsLink: 'https://docs.sentry.io/product/performance/web-vitals',
  },
  fid: {
    description: t(
      'First Input Delay (FID) measures interactivity as the response time when the user tries to interact with the viewport. A low FID helps ensure that a page is useful, and recommend it be less than 100 milliseconds.'
    ),
    examples: [t('When the average FID of a page is longer than 4 seconds.')],
    docsLink: 'https://docs.sentry.io/product/performance/web-vitals',
  },
  cls: {
    description: t(
      'Cumulative Layout Shift (CLS) measures visual stability by quantifying unexpected layout shifts that occur during the entire lifespan of the page. A CLS of less than 0.1 is a good user experience, while anything greater than 0.25 is poor.'
    ),
    examples: [t('When the CLS of a page is more than 0.5.')],
    docsLink: 'https://docs.sentry.io/product/performance/web-vitals',
  },
  fcp: {
    description: t(
      'First Contentful Paint (FCP), like Largest Contentful Paint (LCP), measures loading performance. Specifically, it marks the point when content such as text and images can first be seen on a page.'
    ),
    examples: [t('When the average FCP of a page is longer than 0.25 seconds.')],
    docsLink: 'https://docs.sentry.io/product/performance/web-vitals',
  },
  custom: {
    description: t(
      'Alert on metrics which are not listed above, such as first paint (FP) and time to first byte (TTFB).'
    ),
    examples: [
      t('When the 95th percentile FP of a page is longer than 250 milliseconds.'),
      t('When the average TTFB of a page is longer than 600 millliseconds.'),
    ],
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
  fcp: {
    aggregate: 'p95(measurements.fcp)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
  custom: {
    aggregate: 'p95(measurements.fp)',
    dataset: Dataset.TRANSACTIONS,
    eventTypes: EventTypes.TRANSACTION,
  },
};
