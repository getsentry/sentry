import type {JsonFormObject} from 'sentry/components/forms/types';

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
        label: 'Show Sentry Branding',
        placeholder: 'e.g. secondary@example.com',
        help: 'Show "powered by Sentry within the feedback dialog. We appreciate you helping get the word out about Sentry! <3',
        getData: data => ({options: data}),
      },
      {
        name: 'sentry:feedback_user_report_notifications',
        type: 'boolean',

        label: 'Enable Crash Report Notifications',
        help: 'Get notified on Crash Reports and User Report API submissions. Feedback widget notifications are not affected by this setting and are on by default.',
        getData: data => ({options: data}),
      },
    ],
  },
];

export default formGroups;
