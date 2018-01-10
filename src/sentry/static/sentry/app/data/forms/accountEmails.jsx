import {createSearchMap} from './util';

const forms = [
  {
    // Form "section"/"panel"
    title: 'Add Secondary Emails',
    fields: [
      {
        name: 'email',
        type: 'string',

        // additional data/props that is related to rendering of form field rather than data
        label: 'Additional Email',
        placeholder: 'e.g. secondary@example.com',
        help: 'Designate an alternative email for this account',
      },
    ],
  },
];

export default forms;

// generate search index from form fields
export const searchIndex = createSearchMap({
  route: '/settings/account/emails/',
  formGroups: forms,
});

// need to associate index -> form group -> route
// so when we search for a term we need to find:
//   * what field(s) it matches:
//     * what form group it belongs to
//     * what route that belongs to
