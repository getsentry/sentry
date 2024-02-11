import type {JsonFormObject} from 'sentry/components/forms/types';

export const route = '/settings/:orgId/projects/:projectId/replays/';

const formGroups: JsonFormObject[] = [
  {
    title: 'Settings',
    fields: [
      {
        name: 'sentry:replay_rage_click_issues',
        type: 'boolean',

        // additional data/props that is related to rendering of form field rather than data
        label: 'Create Rage Click Issues',
        help: 'Toggles whether or not to create Session Replay Rage Click Issues',
        getData: data => ({options: data}),
      },
    ],
  },
];

export default formGroups;
