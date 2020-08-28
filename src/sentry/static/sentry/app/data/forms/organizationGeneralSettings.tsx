import {t} from 'app/locale';
import slugify from 'app/utils/slugify';
import {JsonFormObject} from 'app/views/settings/components/forms/type';
import {MemberRole} from 'app/types';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/';

const formGroups: JsonFormObject[] = [
  {
    // Form "section"/"panel"
    title: t('General'),
    fields: [
      {
        name: 'slug',
        type: 'string',
        required: true,
        label: t('Organization Slug'),
        help: t('A unique ID used to identify this organization'),
        transformInput: slugify,
        saveOnBlur: false,
        saveMessageAlertType: 'info',
        saveMessage: t(
          'You will be redirected to the new organization slug after saving'
        ),
      },
      {
        name: 'name',
        type: 'string',
        required: true,
        label: t('Display Name'),
        help: t('A human-friendly name for the organization'),
      },
      {
        name: 'isEarlyAdopter',
        type: 'boolean',
        label: t('Early Adopter'),
        help: t("Opt-in to new features before they're released to the public"),
      },
    ],
  },

  {
    title: 'Membership',
    fields: [
      {
        name: 'defaultRole',
        type: 'array',
        required: true,
        label: t('Default Role'),
        // seems weird to have choices in initial form data
        choices: ({initialData} = {}) =>
          initialData?.availableRoles?.map((r: MemberRole) => [r.id, r.name]) ?? [],
        help: t('The default role new members will receive'),
        disabled: ({access}) => !access.has('org:admin'),
      },
      {
        name: 'openMembership',
        type: 'boolean',
        required: true,
        label: t('Open Membership'),
        help: t('Allow organization members to freely join or leave any team'),
      },
      {
        name: 'eventsMemberAdmin',
        type: 'boolean',
        label: t('Grant Members Events Admin'),
        help: t(
          'Allow members to delete events (including the delete & discard action) by granting them the `event:admin` scope.'
        ),
      },
      {
        name: 'attachmentsRole',
        type: 'array',
        choices: ({initialData = {}}) =>
          initialData?.availableRoles?.map((r: MemberRole) => [r.id, r.name]) ?? [],
        label: t('Attachments Access'),
        help: t(
          'Permissions required to download event attachments, such as native crash reports or log files.'
        ),
        visible: ({features}) => features.has('event-attachments'),
      },
    ],
  },
];

export default formGroups;
