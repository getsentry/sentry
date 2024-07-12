import type {JsonFormObject} from 'sentry/components/forms/types';
import {t, tct} from 'sentry/locale';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/projects/:projectId/user-feedback/';

const formGroups: JsonFormObject[] = [
  {
    // Form "section"/"panel"
    title: 'Settings',
    fields: [
      {
        name: 'feedback:branding',
        type: 'boolean',

        // additional data/props that is related to rendering of form field rather than data
        label: t('Show Sentry Branding in Crash Report Modal'),
        placeholder: 'e.g. secondary@example.com',
        help: t(
          'Show "powered by Sentry" within the Crash Report Modal. We appreciate you helping get the word out about Sentry! <3'
        ),
        getData: data => ({options: data}),
      },
      {
        name: 'sentry:feedback_user_report_notifications',
        type: 'boolean',

        label: t('Enable Crash Report Notifications'),
        help: () =>
          tct(
            'Get notified on feedback submissions from the [crashReportModalDocsLink: Crash Report Modal], [webApiEndpointLink: web endpoint], and JS SDK (pre-v8). [feedbackWidgetDocsLink: Feedback widget] notifications are not affected by this setting and are on by default.',
            {
              crashReportModalDocsLink: (
                <a href="https://docs.sentry.io/platforms/javascript/user-feedback/#crash-report-modal" />
              ),
              feedbackWidgetDocsLink: (
                <a href="https://docs.sentry.io/product/user-feedback/#user-feedback-widget" />
              ),
              webApiEndpointLink: (
                <a href="https://docs.sentry.io/api/projects/submit-user-feedback/" />
              ),
            }
          ),
        getData: data => ({options: data}),
      },
      {
        name: 'sentry:feedback_ai_spam_detection',
        type: 'boolean',

        // additional data/props that is related to rendering of form field rather than data
        label: 'Enable Spam Detection',
        help: 'Toggles whether or not to enable auto spam detection in User Feedback.',
        getData: data => ({options: data}),
      },
    ],
  },
];

export default formGroups;
