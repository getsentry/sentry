import {JsonFormObject} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import {MemberRole} from 'sentry/types';
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
  {
    title: 'Team Organization Role',
    fields: [
      {
        name: 'orgRole',
        type: 'select',
        choices: ({orgRoleList}) => {
          const choices = orgRoleList.map((r: MemberRole) => [r.id, r.name]) ?? [];
          choices.unshift(['', 'None']);
          return choices;
        },
        required: false,
        label: t('Organization Role'),
        help: t('The organization role that team members will have access to'),
        disabled: ({access, idpProvisioned}) =>
          !access.has('org:admin') || idpProvisioned,
        visible: ({hasOrgRoleFlag}) => hasOrgRoleFlag,
        saveOnBlur: false,
        saveMessageAlertType: 'info',
        saveMessage: t(
          'You are giving all team members the permissions of this organization role'
        ),
      },
    ],
  },
];

export default formGroups;
