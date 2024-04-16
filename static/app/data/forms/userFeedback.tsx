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
        label: t('Show Sentry Branding'),
        placeholder: 'e.g. secondary@example.com',
        help: t(
          'Show "powered by Sentry" within the feedback dialog. We appreciate you helping get the word out about Sentry! <3'
        ),
        getData: data => ({options: data}),
      },
      {
        name: 'sentry:feedback_user_report_notifications',
        type: 'boolean',

        label: t('Enable Crash Report Notifications'),
        help: () =>
          tct(
            'Get notified on [crashReportModalDocsLink: Crash Report Modal and User Report API submissions]. [feedbackWidgetDocsLink: Feedback widget] notifications are not affected by this setting and are on by default.',
            {
              crashReportModalDocsLink: (
                <a href="https://docs.sentry.io/platforms/javascript/user-feedback/#crash-report-modal" />
              ),
              feedbackWidgetDocsLink: (
                <a href="https://docs.sentry.io/product/user-feedback/#user-feedback-widget" />
              ),
            }
          ),
        getData: data => ({options: data}),
      },
    ],
  },
];

export default formGroups;
