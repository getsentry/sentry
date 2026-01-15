import type {JsonFormObject} from 'sentry/components/forms/types';
import type {User} from 'sentry/types/user';

export const route = '/settings/account/details/';

// For fields that are
const getUserIsManaged = ({user}: any) => user.isManaged;

const baseFormGroups: readonly JsonFormObject[] = [
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

/**
 * Factory function to create account details form with optional userId field
 * For search: invoke with {includeUserId: true, user: {id: ''}} to get all searchable fields
 */
export function createAccountDetailsForm(options?: {
  includeUserId?: boolean;
  user?: User;
}): readonly JsonFormObject[] {
  if (!options?.includeUserId || !options?.user) {
    return baseFormGroups;
  }

  return [
    {
      ...baseFormGroups[0]!,
      fields: [
        ...baseFormGroups[0]!.fields,
        {
          name: 'userId',
          type: 'string',
          disabled: true,
          label: 'User ID',
          setValue(_, _name) {
            return options.user!.id;
          },
          help: `The unique identifier for your account. It cannot be modified.`,
        },
      ],
    },
  ];
}

export default baseFormGroups;
