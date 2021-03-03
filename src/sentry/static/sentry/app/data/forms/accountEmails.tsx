import {JsonFormObject} from 'app/views/settings/components/forms/type';

// Export route to make these forms searchable by label/help
export const route = '/settings/account/emails/';

const formGroups: JsonFormObject[] = [
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
        showReturnButton: true,
      },
    ],
  },
];

export default formGroups;
