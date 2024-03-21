import type {JsonFormObject} from 'sentry/components/forms/types';

export const route = '/settings/:orgId/projects/:projectId/user-feedback-processing/';

const formGroups: JsonFormObject[] = [
  {
    title: 'Settings',
    fields: [
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
