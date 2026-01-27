import type {JsonFormObject} from 'sentry/components/forms/types';
import type {FormSearchContext} from 'sentry/data/forms/accountDetails';
import {t} from 'sentry/locale';
import slugify from 'sentry/utils/slugify';

// Export route to make these forms searchable by label/help
// TODO: :teamId is not a valid route parameter
// export const route = '/settings/:orgId/teams/:teamId/settings/';

const baseFormGroups: readonly JsonFormObject[] = [
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
        saveMessageAlertVariant: 'info',
        saveMessage: t('You will be redirected to the new team slug after saving.'),
      },
    ],
  },
];

/**
 * Factory function to create team settings form with teamId field for search.
 * Accepts FormSearchContext for consistency with other form factories.
 */
export function createTeamSettingsForm(
  context: FormSearchContext
): readonly JsonFormObject[] {
  const {team} = context;

  // Always include teamId field for search discoverability
  return [
    {
      ...baseFormGroups[0]!,
      fields: [
        ...baseFormGroups[0]!.fields,
        {
          name: 'teamId',
          type: 'string',
          disabled: true,
          label: t('Team ID'),
          setValue(_, _name) {
            return team?.id ?? '';
          },
          help: `The unique identifier for this team. It cannot be modified.`,
        },
      ],
    },
  ];
}

export default baseFormGroups;
