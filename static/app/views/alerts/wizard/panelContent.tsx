import diagramApdex from 'sentry-images/spot/alerts-wizard-apdex.svg';
import diagramCLS from 'sentry-images/spot/alerts-wizard-cls.svg';
import diagramCrashFreeSessions from 'sentry-images/spot/alerts-wizard-crash-free-sessions.svg';
import diagramCrashFreeUsers from 'sentry-images/spot/alerts-wizard-crash-free-users.svg';
import diagramCrons from 'sentry-images/spot/alerts-wizard-crons.svg';
import diagramCustomTransaction from 'sentry-images/spot/alerts-wizard-custom.svg';
import diagramCustomMetrics from 'sentry-images/spot/alerts-wizard-custom-metrics.svg';
import diagramErrors from 'sentry-images/spot/alerts-wizard-errors.svg';
import diagramFailureRate from 'sentry-images/spot/alerts-wizard-failure-rate.svg';
import diagramFID from 'sentry-images/spot/alerts-wizard-fid.svg';
import diagramIssues from 'sentry-images/spot/alerts-wizard-issues.svg';
import diagramLCP from 'sentry-images/spot/alerts-wizard-lcp.svg';
import diagramThroughput from 'sentry-images/spot/alerts-wizard-throughput.svg';
import diagramTransactionDuration from 'sentry-images/spot/alerts-wizard-transaction-duration.svg';
import diagramUptime from 'sentry-images/spot/alerts-wizard-uptime.svg';
import diagramUsers from 'sentry-images/spot/alerts-wizard-users-experiencing-errors.svg';

import {t} from 'sentry/locale';

import type {AlertType} from './options';

type PanelContent = {
  description: React.ReactNode;
  examples: string[];
  docsLink?: string;
  illustration?: string;
};

export const AlertWizardPanelContent: Record<AlertType, PanelContent> = {
  issues: {
    description: t(
      'Issues are groups of errors that have a similar stacktrace. Set an alert for new issues, when an issue changes state, frequency of errors, or users affected by an issue.'
    ),
    examples: [
      t("When the triggering event's level is fatal."),
      t('When an issue was seen 100 times in the last 2 days.'),
      t(
        'Create a JIRA ticket when an issue changes state from resolved to unresolved and is unassigned.'
      ),
    ],
    illustration: diagramIssues,
  },
  num_errors: {
    description: t(
      'Alert when the number of errors in a project matching your filters crosses a threshold. This is useful for monitoring the overall level or errors in your project or errors occurring in specific parts of your app.'
    ),
    examples: [
      t('When the signup page has more than 10k errors in 5 minutes.'),
      t('When there are more than 500k errors in 10 minutes from a specific file.'),
    ],
    illustration: diagramErrors,
  },
  users_experiencing_errors: {
    description: t(
      'Alert when the number of users affected by errors in your project crosses a threshold.'
    ),
    examples: [
      t('When 100k users experience an error in 1 hour.'),
      t('When 100 users experience a problem on the Checkout page.'),
    ],
    illustration: diagramUsers,
  },
  throughput: {
    description: t(
      'Throughput is the total number of transactions in a project and you can alert when it reaches a threshold within a period of time.'
    ),
    examples: [
      t('When number of transactions on a key page exceeds 100k per minute.'),
      t('When number of transactions drops below a threshold.'),
    ],
    illustration: diagramThroughput,
  },
  trans_duration: {
    description: t(
      'Monitor how long it takes for transactions to complete. Use flexible aggregates like percentiles, averages, and min/max.'
    ),
    examples: [
      t('When any transaction is slower than 3 seconds.'),
      t('When the 75th percentile response time is higher than 250 milliseconds.'),
    ],
    illustration: diagramTransactionDuration,
  },
  apdex: {
    description: t(
      'Apdex is a metric used to track and measure user satisfaction based on your application response times. The Apdex score provides the ratio of satisfactory, tolerable, and frustrated requests in a specific transaction or endpoint.'
    ),
    examples: [t('When apdex is below 300.')],
    docsLink: 'https://docs.sentry.io/product/performance/metrics/#apdex',
    illustration: diagramApdex,
  },
  failure_rate: {
    description: t(
      'Failure rate is the percentage of unsuccessful transactions. Sentry treats transactions with a status other than “ok,” “canceled,” and “unknown” as failures.'
    ),
    examples: [t('When the failure rate for an important endpoint reaches 10%.')],
    docsLink: 'https://docs.sentry.io/product/performance/metrics/#failure-rate',
    illustration: diagramFailureRate,
  },
  lcp: {
    description: t(
      'Largest Contentful Paint (LCP) measures loading performance. It marks the point when the largest image or text block is visible within the viewport. A fast LCP helps reassure the user that the page is useful, and so we recommend an LCP of less than 2.5 seconds.'
    ),
    examples: [
      t('When the 75th percentile LCP of your homepage is longer than 2.5 seconds.'),
    ],
    docsLink: 'https://docs.sentry.io/product/performance/web-vitals',
    illustration: diagramLCP,
  },
  fid: {
    description: t(
      'First Input Delay (FID) measures interactivity as the response time when the user tries to interact with the viewport. A low FID helps ensure that a page is useful, and we recommend a FID of less than 100 milliseconds.'
    ),
    examples: [t('When the average FID of a page is longer than 4 seconds.')],
    docsLink: 'https://docs.sentry.io/product/performance/web-vitals',
    illustration: diagramFID,
  },
  cls: {
    description: t(
      'Cumulative Layout Shift (CLS) measures visual stability by quantifying unexpected layout shifts that occur during the entire lifespan of the page. A CLS of less than 0.1 is a good user experience, while anything greater than 0.25 is poor.'
    ),
    examples: [t('When the CLS of a page is more than 0.5.')],
    docsLink: 'https://docs.sentry.io/product/performance/web-vitals',
    illustration: diagramCLS,
  },
  custom_transactions: {
    description: t(
      'Alert on performance metrics which are not listed above, such as first paint (FP), first contentful paint (FCP), and time to first byte (TTFB).'
    ),
    examples: [
      t('When the 95th percentile FP of a page is longer than 250 milliseconds.'),
      t('When the average TTFB of a page is longer than 600 millliseconds.'),
    ],
    illustration: diagramCustomTransaction,
  },
  custom_metrics: {
    description: t(
      'Alert on custom metrics that you have configured and are not related to errors, transactions or sessions.'
    ),
    examples: [
      t('When the number of sign-ups dropped by 10% compared to the previous week.'),
      t(
        'When the 75th percentile of your login flow is taking longer than 500 milliseconds.'
      ),
    ],
    illustration: diagramCustomMetrics,
  },
  crash_free_sessions: {
    description: t(
      'A session begins when a user starts the application and ends when it’s closed or sent to the background. A crash is when a session ends due to an error and this type of alert lets you monitor when those crashed sessions exceed a threshold. This lets you get a better picture of the health of your app.'
    ),
    examples: [
      t('When the Crash Free Rate is below 98%, send a Slack notification to the team.'),
    ],
    illustration: diagramCrashFreeSessions,
  },
  crash_free_users: {
    description: t(
      'Crash Free Users is the percentage of distinct users that haven’t experienced a crash and so this type of alert tells you when the overall user experience dips below a certain unacceptable threshold.'
    ),
    examples: [
      t('When the Crash Free Rate is below 97%, send an email notification to yourself.'),
    ],
    illustration: diagramCrashFreeUsers,
  },
  uptime_monitor: {
    description: t(
      'Alert when the availability or reliability of a monitored URL changes, providing instant notifications and insights to quickly detect and resolve issues.'
    ),
    examples: [
      t('When the URL returns a response status code other than 200.'),
      t('When the URL response times out after 20 seconds.'),
      t('When a DNS resolution error is detected for the URL.'),
    ],
    illustration: diagramUptime,
  },
  crons_monitor: {
    description: t(
      'Alert on scheduled monitors that check-in on recurring jobs and tell you if they’re running on schedule, failing, or succeeding.'
    ),
    examples: [
      t('When a scheduled job fails during execution'),
      t("When a scheduled job runs for longer than it's expected runtime"),
      t('When a scheduled job does not run'),
    ],
    illustration: diagramCrons,
  },
  eap_metrics: {
    description: t('Alert on spans.'),
    examples: [
      t('When your average time in queue exceeds 100ms.'),
      t('When your app runs more than 1000 queries in a minute.'),
    ],
    illustration: diagramThroughput,
  },
};
