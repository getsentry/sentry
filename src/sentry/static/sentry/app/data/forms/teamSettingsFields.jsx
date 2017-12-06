import {createSearchMap} from './util';

const forms = [
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

export default forms;

// generate search index from form fields
export const searchIndex = createSearchMap({
  route: '/settings/organization/:orgId/teams/:teamId/settings/',
  requireParams: ['orgId', 'teamId'],
  formGroups: forms,
});

// need to associate index -> form group -> route
// so when we search for a term we need to find:
//   * what field(s) it matches:
//     * what form group it belongs to
//     * what route that belongs to
