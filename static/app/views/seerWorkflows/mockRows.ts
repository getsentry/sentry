import type {WorkflowRow} from 'sentry/views/seerWorkflows/types';

const MOCK_RUN_PREFIX = 'mock-feedback-summary';

const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 60 * 60_000).toISOString();
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60_000).toISOString();

export const MOCK_FEEDBACK_SUMMARY_ROWS: WorkflowRow[] = [
  {
    id: `${MOCK_RUN_PREFIX}-happy:feedback_summary`,
    runId: `${MOCK_RUN_PREFIX}-happy`,
    dateAdded: '2026-05-11T10:33:00Z',
    kind: 'feedback_summary',
    status: 'succeeded',
    source: 'cron',
    options: {intelligence_level: 'medium', reasoning_effort: 'medium'},
    summary:
      "Today's feedback is dominated by login flakiness — users keep getting bounced back to the sign-in screen mid-session, especially on the dashboard. Slow chart loads on the issues page are a close second, followed by a smaller cluster of CSV export errors that started after yesterday's release. A handful of users also called out confusing onboarding copy when setting up their first project. Most reports are from web users; mobile traffic looks normal.",
    feedback: {
      agentRunId: 9001,
      summary:
        "Today's feedback is dominated by login flakiness — users keep getting bounced back to the sign-in screen mid-session, especially on the dashboard. Slow chart loads on the issues page are a close second, followed by a smaller cluster of CSV export errors that started after yesterday's release. A handful of users also called out confusing onboarding copy when setting up their first project. Most reports are from web users; mobile traffic looks normal.",
      themes: [
        {
          title: 'Login flakiness mid-session',
          description:
            'Authenticated users are being redirected to the sign-in screen after a few minutes, frequently while interacting with the dashboard.',
          feedbackGroupIds: [1011, 1012, 1015, 1019, 1027, 1031, 1042],
        },
        {
          title: 'Slow issues-page chart loads',
          description:
            'The trend and event-count charts on the issues page are taking 10+ seconds to render for orgs with high event volume.',
          feedbackGroupIds: [1014, 1022, 1029, 1036],
        },
        {
          title: 'CSV export errors',
          description:
            "Exporting events to CSV is returning a 500 since yesterday's release. Affects multiple projects.",
          feedbackGroupIds: [1037, 1040, 1041],
        },
        {
          title: 'Confusing first-project onboarding',
          description:
            'New users say the platform-picker step in onboarding is unclear about which SDK to install.',
          feedbackGroupIds: [1024, 1033],
        },
      ],
      numFeedbacksAnalyzed: 47,
    },
  },
  {
    id: `${MOCK_RUN_PREFIX}-skipped:feedback_summary`,
    runId: `${MOCK_RUN_PREFIX}-skipped`,
    dateAdded: '2026-05-10T10:33:00Z',
    kind: 'feedback_summary',
    status: 'skipped',
    source: 'cron',
    summary:
      'Skipped: only 4 user feedbacks landed in the last 24 hours, below the minimum threshold of 10 needed for a meaningful summary.',
    feedback: {
      summary: '',
      themes: [],
      numFeedbacksAnalyzed: 4,
      reason: 'insufficient_feedbacks',
    },
  },
  {
    id: `${MOCK_RUN_PREFIX}-failed:feedback_summary`,
    runId: `${MOCK_RUN_PREFIX}-failed`,
    dateAdded: '2026-05-09T10:33:00Z',
    kind: 'feedback_summary',
    status: 'failed',
    source: 'cron',
    summary:
      'The feedback summary agent crashed mid-run before producing an artifact. See the error message below for details.',
    errorMessage:
      'Feedback summary agent finished with status=errored but produced no artifact',
    feedback: {
      agentRunId: 9002,
      summary: '',
      themes: [],
      numFeedbacksAnalyzed: 0,
    },
  },
];

// Representative mock runs for the 6 other configurable strategies that
// don't have specialized count rendering yet. Each carries a strategy-
// appropriate `resultText` (rendered in the Result cell) and a matching
// `summary` (rendered in the expanded view) so the numbers tell the same
// story across both surfaces.
export const MOCK_OTHER_STRATEGY_ROWS: WorkflowRow[] = [
  {
    id: 'mock-autofix-followup-1:autofix_followup',
    runId: 'mock-autofix-followup-1',
    dateAdded: hoursAgo(7),
    kind: 'autofix_followup',
    status: 'succeeded',
    source: 'cron',
    summary:
      "Reviewed yesterday's 8 autofix proposals. 6 look correct and ready to merge; 2 need an owner to weigh in — one changes a public API signature, one lacks regression tests for the failure path.",
    resultText: '8 runs reviewed · 2 need owner review',
  },
  {
    id: 'mock-release-regression-1:release_regression_scout',
    runId: 'mock-release-regression-1',
    dateAdded: hoursAgo(11),
    kind: 'release_regression_scout',
    status: 'succeeded',
    source: 'cron',
    summary:
      "Reviewed release 24.5.0's first 24 hours. Found 1 new error type (TypeError in checkout flow) and a 1.2pp crash-free-sessions dip on iOS — both correlate to suspect commit abc1234.",
    resultText: '2 regressions in release 24.5.0',
  },
  {
    id: 'mock-performance-regression-1:performance_regression_scout',
    runId: 'mock-performance-regression-1',
    dateAdded: hoursAgo(19),
    kind: 'performance_regression_scout',
    status: 'succeeded',
    source: 'cron',
    summary:
      "Compared this week's transaction p95s against the prior baseline. 3 endpoints regressed; top is `POST /api/issues/` p95 8.4s → 18s, span breakdown points at a new N+1 query in the tag-fetch path, likely introduced by deploy abc1234.",
    resultText: '3 endpoints regressed',
  },
  {
    id: 'mock-replay-friction-1:replay_friction_finder',
    runId: 'mock-replay-friction-1',
    dateAdded: daysAgo(1),
    kind: 'replay_friction_finder',
    status: 'succeeded',
    source: 'cron',
    summary:
      'Scanned 87 replays with elevated rage-click or dead-click density. Clustered into 4 friction themes: login flakiness, slow chart loads on /issues/, CSV export errors, and a misaligned settings save button.',
    resultText: '4 friction themes · 87 replays',
  },
  {
    id: 'mock-alert-tuning-1:alert_tuning_advisor',
    runId: 'mock-alert-tuning-1',
    dateAdded: daysAgo(3),
    kind: 'alert_tuning_advisor',
    status: 'succeeded',
    source: 'cron',
    summary:
      'Reviewed 12 alert rules over the last 30 days. Flagged 2 noisy rules (>50 fires, <10% acked), 1 dead rule (0 fires in 90 days), and 1 fatigue-inducing rule (fires hourly). Per-rule suggestions posted as banners.',
    resultText: '12 rules reviewed · 4 suggestions',
  },
  {
    id: 'mock-cron-monitor-1:cron_monitor_doctor',
    runId: 'mock-cron-monitor-1',
    dateAdded: daysAgo(5),
    kind: 'cron_monitor_doctor',
    status: 'succeeded',
    source: 'cron',
    summary:
      'Reviewed 7 cron monitors. 1 has a max-runtime too tight for its recent p95 (suggesting a bump from 60s → 180s); 2 are missing check-ins recurrently on Sundays, suggesting a grace-period extension.',
    resultText: '7 monitors reviewed · 3 suggestions',
  },
];
