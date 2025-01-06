import type {JsonFormObject} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import type {BaseRole} from 'sentry/types/organization';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/';

const formGroups: JsonFormObject[] = [
  {
    title: 'Membership',
    fields: [
      {
        name: 'defaultRole',
        type: 'select',
        label: t('Default Role'),
        // seems weird to have choices in initial form data
        choices: ({initialData} = {}) =>
          initialData?.orgRoleList?.map((r: BaseRole) => [r.id, r.name]) ?? [],
        help: t('The default role new members will receive'),
        disabled: ({access}) => !access.has('org:admin'),
      },
      {
        name: 'openMembership',
        type: 'boolean',
        label: t('Open Team Membership'),
        help: t('Allow organization members to freely join any team'),
      },
      {
        name: 'allowMemberInvite',
        type: 'boolean',
        label: t('Let Members Invite Others'),
        help: t(
          'Allow organization members to invite other members via email without needing org owner or manager approval.'
        ),
      },
      {
        name: 'allowMemberProjectCreation',
        type: 'boolean',
        label: t('Let Members Create Projects'),
        help: t('Allow organization members to create and configure new projects.'),
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
          initialData?.orgRoleList?.map((r: BaseRole) => [r.id, r.name]) ?? [],
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
          initialData?.orgRoleList?.map((r: BaseRole) => [r.id, r.name]) ?? [],
        label: t('Debug Files Access'),
        help: t(
          'Role required to download debug information files, proguard mappings and source maps.'
        ),
      },
    ],
  },
];

export default formGroups;
