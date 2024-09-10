import type {JsonFormObject} from 'sentry/components/forms/types';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {BaseRole} from 'sentry/types/organization';
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
        help: tct("Opt-in to [link:new features] before they're released to the public", {
          link: (
            <ExternalLink href="https://docs.sentry.io/product/accounts/early-adopter/" />
          ),
        }),
        visible: () => !ConfigStore.get('isSelfHostedErrorsOnly'),
      },
      {
        name: 'aiSuggestedSolution',
        type: 'boolean',
        label: t('AI Suggested Solution'),
        help: tct(
          'Opt-in to [link:ai suggested solution] to get AI help on how to solve an issue.',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/ai-suggested-solution/" />
            ),
          }
        ),
        visible: () => !ConfigStore.get('isSelfHostedErrorsOnly'),
      },
      {
        name: 'uptimeAutodetection',
        type: 'boolean',
        label: t('Automatically Configure Uptime Alerts'),
        help: t('Detect most-used URLs for uptime monitoring.'),
        // TOOD(epurkhiser): Currently there's no need for users to change this
        // setting as it will just be confusing. In the future when
        // autodetection is used for suggested URLs it will make more sense to
        // for users to have the option to disable this.
        visible: false,
      },
    ],
  },

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
        visible: ({features}) => features.has('members-invite-teammates'),
        disabled: ({features, access}) =>
          !access.has('org:write') || !features.has('team-roles'),
        disabledReason: ({features}) =>
          !features.has('team-roles')
            ? t('You must be on a business plan to toggle this feature.')
            : undefined,
      },
      {
        name: 'allowMemberProjectCreation',
        type: 'boolean',
        label: t('Let Members Create Projects'),
        help: t('Allow organization members to create and configure new projects.'),
        disabled: ({features, access}) =>
          !access.has('org:write') || !features.has('team-roles'),
        disabledReason: ({features}) =>
          !features.has('team-roles')
            ? t('You must be on a business plan to toggle this feature.')
            : undefined,
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
