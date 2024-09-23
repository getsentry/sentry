import type {JsonFormObject} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import slugify from 'sentry/utils/slugify';

// Export route to make these forms searchable by label/help
// TODO: :teamId is not a valid route parameter
// export const route = '/settings/:orgId/teams/:teamId/settings/';

const formGroups: JsonFormObject[] = [
  {
    // Form "section"/"panel"
    title: 'Team Settings',
    fields: [
      {
        name: 'slug',
        type: 'string',
        required: true,
        label: t('Team Slug'),
        placeholder: 'e.g. api-team',
        help: t('A unique ID used to identify the team'),
        transformInput: slugify,
        disabled: ({hasTeamWrite}) => !hasTeamWrite,
        saveOnBlur: false,
        saveMessageAlertType: 'info',
        saveMessage: t('You will be redirected to the new team slug after saving'),
      },
    ],
  },
];

export default formGroups;
