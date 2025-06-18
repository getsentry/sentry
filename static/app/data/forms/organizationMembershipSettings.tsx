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
        confirm: {
          isDangerous: true,
          true: t(
            'This will allow any members of your organization to freely join any team and access any project of your organization. Do you want to continue?'
          ),
          false: t(
            'This will disallow free access to any team and project within your organization. Do you want to continue?'
          ),
        },
      },
      {
        name: 'allowMemberInvite',
        type: 'boolean',
        label: t('Let Members Invite Others'),
        help: t(
          'Allow organization members to invite other members via email without needing org owner or manager approval.'
        ),
        confirm: {
          isDangerous: true,
          true: t(
            'This will allow any members of your organization to invite other members via email without needing org owner or manager approval. Do you want to continue?'
          ),
        },
      },
      {
        name: 'allowMemberProjectCreation',
        type: 'boolean',
        label: t('Let Members Create Projects'),
        help: t('Allow organization members to create and configure new projects.'),
        confirm: {
          isDangerous: true,
          true: t(
            'This will allow any members of your organization to create and configure new projects. Do you want to continue?'
          ),
        },
      },
      {
        name: 'eventsMemberAdmin',
        type: 'boolean',
        label: t('Let Members Delete Events'),
        help: t(
          'Allow members to delete events (including the delete & discard action) by granting them the `event:admin` scope.'
        ),
        confirm: {
          isDangerous: true,
          true: t(
            'This will allow any members of your organization to delete events. Do you want to continue?'
          ),
        },
      },
      {
        name: 'alertsMemberWrite',
        type: 'boolean',
        label: t('Let Members Create and Edit Alerts'),
        help: t(
          'Allow members to create, edit, and delete alert rules by granting them the `alerts:write` scope.'
        ),
        confirm: {
          isDangerous: true,
          true: t(
            'This will allow any members of your organization to create, edit, and delete alert rules in all projects. Do you want to continue?'
          ),
        },
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
