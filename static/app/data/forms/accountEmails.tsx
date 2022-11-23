import {JsonFormObject} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';

// Export route to make these forms searchable by label/help
export const route = '/settings/account/emails/';

const formGroups: JsonFormObject[] = [
  {
    // Form "section"/"panel"
    title: t('Add Secondary Emails'),
    fields: [
      {
        name: 'email',
        type: 'string',

        // additional data/props that is related to rendering of form field rather than data
        label: t('Additional Email'),
        placeholder: t('e.g. secondary@example.com'),
        help: t('Designate an alternative email for this account'),
        saveOnBlur: false,
        saveMessage: t('Add this new email address to your account?'),
      },
    ],
  },
];

export default formGroups;
