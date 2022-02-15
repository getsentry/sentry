import {JsonFormObject} from 'sentry/components/forms/type';
import {t} from 'sentry/locale';
import {MemberRole} from 'sentry/types';
import slugify from 'sentry/utils/slugify';

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
        type: 'select',
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
        label: t('Let Members Delete Events'),
        help: t(
          'Allow members to delete events (including the delete & discard action) by granting them the `event:admin` scope.'
        ),
      },
      {
        name: 'alertsMemberWrite',
        type: 'boolean',
        label: t('Let Members Create and Edit Alerts'),
        help: t(
          'Allow members to create, edit, and delete alert rules by granting them the `alerts:write` scope.'
        ),
      },
      {
        name: 'attachmentsRole',
        type: 'select',
        choices: ({initialData = {}}) =>
          initialData?.availableRoles?.map((r: MemberRole) => [r.id, r.name]) ?? [],
        label: t('Attachments Access'),
        help: t(
          'Role required to download event attachments, such as native crash reports or log files.'
        ),
        visible: ({features}) => features.has('event-attachments'),
      },
      {
        name: 'debugFilesRole',
        type: 'select',
        choices: ({initialData = {}}) =>
          initialData?.availableRoles?.map((r: MemberRole) => [r.id, r.name]) ?? [],
        label: t('Debug Files Access'),
        help: t(
          'Role required to download debug information files, proguard mappings and source maps.'
        ),
      },
    ],
  },
];

export default formGroups;
