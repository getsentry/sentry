import {JsonFormObject} from 'app/views/settings/components/forms/type';

export const route = '/settings/account/details/';

// For fields that are
const getUserIsManaged = ({user}) => user.isManaged;

const formGroups: JsonFormObject[] = [
  {
    // Form "section"/"panel"
    title: 'Account Details',
    fields: [
      {
        name: 'name',
        type: 'string',
        required: true,

        // additional data/props that is related to rendering of form field rather than data
        label: 'Name',
        placeholder: 'e.g. John Doe',
        help: 'Your full name',
      },
      {
        name: 'username',
        type: 'string',
        required: true,

        autoComplete: 'username',
        label: 'Username',
        placeholder: 'e.g. name@example.com',
        help: '',
        disabled: getUserIsManaged,
        visible: ({user}) => user.email !== user.username,
      },
    ],
  },
];

export default formGroups;
