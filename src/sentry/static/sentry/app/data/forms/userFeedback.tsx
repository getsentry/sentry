import {JsonFormObject} from 'app/views/settings/components/forms/type';

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
        help:
          'Show "powered by Sentry within the feedback dialog. We appreciate you helping get the word out about Sentry! <3',
        getData: data => ({options: data}),
      },
    ],
  },
];

export default formGroups;
