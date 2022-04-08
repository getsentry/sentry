import {JsonFormObject} from 'sentry/components/forms/type';
import {t} from 'sentry/locale';
import slugify from 'sentry/utils/slugify';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/teams/:teamId/settings/';

const formGroups: JsonFormObject[] = [
  {
    // Form "section"/"panel"
    title: 'Team Settings',
    fields: [
      {
        name: 'slug',
        type: 'string',
        required: true,
        label: t('Name'),
        placeholder: 'e.g. api-team',
        help: t('A unique ID used to identify the team'),
        disabled: ({access}) => !access.has('team:write'),
        transformInput: slugify,

        saveOnBlur: false,
        saveMessageAlertType: 'info',
        saveMessage: t('You will be redirected to the new team slug after saving'),
      },
    ],
  },
];

export default formGroups;
