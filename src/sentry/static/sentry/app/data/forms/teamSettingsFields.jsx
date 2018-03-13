// Export route to make these forms searchable by label/help
export const route = '/settings/organization/:orgId/teams/:teamId/settings/';

const formGroups = [
  {
    // Form "section"/"panel"
    title: 'Team Settings',
    fields: [
      {
        name: 'name',
        type: 'string',
        required: true,

        // additional data/props that is related to rendering of form field rather than data
        label: 'Name',
        placeholder: 'e.g. API Team',
        help: 'The name of your team',
      },
      {
        name: 'slug',
        type: 'string',
        required: true,
        label: 'Short Name',
        placeholder: 'e.g. api-team',
        help: 'A unique ID used to identify the team',
      },
    ],
  },
];

export default formGroups;
