import type {WorkflowRow} from 'sentry/views/seerWorkflows/types';

const MOCK_RUN_PREFIX = 'mock-feedback-summary';

export const MOCK_FEEDBACK_SUMMARY_ROWS: WorkflowRow[] = [
  {
    id: `${MOCK_RUN_PREFIX}-happy:feedback_summary`,
    runId: `${MOCK_RUN_PREFIX}-happy`,
    dateAdded: '2026-05-11T10:33:00Z',
    kind: 'feedback_summary',
    status: 'succeeded',
    source: 'cron',
    options: {intelligence_level: 'medium', reasoning_effort: 'medium'},
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
