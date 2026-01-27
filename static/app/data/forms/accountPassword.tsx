import type {JsonFormObject} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';

const getUserIsNotManaged = ({user}: any) => !user.isManaged;

const formGroups: readonly JsonFormObject[] = [
  {
    // Form "section"/"panel"
    title: 'Password',
    fields: [
      {
        name: 'password',
        type: 'secret',
        autoComplete: 'current-password',
        label: t('Current Password'),
        help: t('Your current password'),
        placeholder: t('Your current password'),
        visible: getUserIsNotManaged,
        required: true,
      },
      {
        name: 'passwordNew',
        type: 'secret',
        autoComplete: 'new-password',
        label: t('New Password'),
        placeholder: t('Your new password'),
        required: true,
        visible: getUserIsNotManaged,
        validate: ({id, form}) => (form[id] === form.passwordVerify ? [] : [[id, '']]),
      },
      {
        name: 'passwordVerify',
        type: 'secret',
        autoComplete: 'new-password',
        label: t('Verify New Password'),
        help: t('Verify your new password'),
        placeholder: t('Verify your new password'),
        required: true,
        visible: getUserIsNotManaged,
        validate: ({id, form}) => {
          // If password is set, and passwords don't match, then return an error
          if (form.passwordNew && form.passwordNew !== form[id]) {
            return [[id, t('Passwords do not match')]];
          }

          return [];
        },
      },
    ],
  },
];

export const route = '/settings/account/security/';
export default formGroups;
