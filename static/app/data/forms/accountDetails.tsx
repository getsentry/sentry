import type {JsonFormObject} from 'sentry/components/forms/types';
import type {Organization, Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';

export type FormSearchContext = {
  access: Set<string>;
  organization: Organization | null;
  user: User | null;
  team?: Team | null;
};

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
 * Factory function to create account details form with userId field for search.
 * Accepts FormSearchContext for consistency with other form factories.
 */
export function createAccountDetailsForm(
  context: FormSearchContext
): readonly JsonFormObject[] {
  const {user} = context;

  if (!user) {
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
            return user.id;
          },
          help: `The unique identifier for your account. It cannot be modified.`,
        },
      ],
    },
  ];
}

export default baseFormGroups;
