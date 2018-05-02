import React from 'react';

import {extractMultilineFields} from 'app/utils';
import {t, tct} from 'app/locale';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/';

const formGroups = [
  {
    // Form "section"/"panel"
    title: t('General'),
    fields: [
      {
        name: 'slug',
        type: 'string',
        required: true,
        label: t('Name'),
        help: t('A unique ID used to identify this organization'),

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

        label: t('Legacy Name'),
        help: tct(
          '[Deprecated] In the future, only [Name] will be used to identify your organization',
          {
            Deprecated: <strong>DEPRECATED</strong>,
            Name: <strong>Name</strong>,
          }
        ),
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
          (initialData.availableRoles &&
            initialData.availableRoles.map(r => [r.id, r.name])) ||
          [],
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
    ],
  },

  {
    title: t('Security & Privacy'),
    fields: [
      {
        name: 'require2FA',
        type: 'boolean',
        label: t('Require Two-Factor Authentication'),
        help: t('Require two-factor authentication for all members'),
        confirm: {
          true: t(
            'Enabling this feature will disable all accounts without two-factor authentication. It will also send an email to all users to enable two-factor authentication. Do you want to continue?'
          ),
          false: t(
            'Are you sure you want to allow users to access your organization without having two-factor authentication enabled?'
          ),
        },
        visible: ({features}) => features.has('require-2fa'),
      },
      {
        name: 'allowSharedIssues',
        type: 'boolean',

        label: t('Allow Shared Issues'),
        help: t('Enable sharing of limited details on issues to anonymous users'),
        confirm: {
          true: t('Are you sure you want to allow sharing issues to anonymous users?'),
        },
      },
      {
        name: 'enhancedPrivacy',
        type: 'boolean',

        label: t('Enhanced Privacy'),
        help: t(
          'Enable enhanced privacy controls to limit personally identifiable information (PII) as well as source code in things like notifications'
        ),
        confirm: {
          false: t(
            'Disabling this can have privacy implications for ALL projects, are you sure you want to continue?'
          ),
        },
      },
      {
        name: 'dataScrubber',
        type: 'boolean',
        label: t('Require Data Scrubber'),
        help: t('Require server-side data scrubbing be enabled for all projects'),
        confirm: {
          false: t(
            'Disabling this can have privacy implications for ALL projects, are you sure you want to continue?'
          ),
        },
      },
      {
        name: 'dataScrubberDefaults',
        type: 'boolean',
        label: t('Require Using Default Scrubbers'),
        help: t(
          'Require the default scrubbers be applied to prevent things like passwords and credit cards from being stored for all projects'
        ),
        confirm: {
          false: t(
            'Disabling this can have privacy implications for ALL projects, are you sure you want to continue?'
          ),
        },
      },
      {
        name: 'sensitiveFields',
        type: 'string',
        multiline: true,
        placeholder: 'e.g. email',
        label: t('Global sensitive fields'),
        help: t(
          'Additional field names to match against when scrubbing data for all projects. Separate multiple entries with a newline.'
        ),
        extraHelp: t(
          'Note: These fields will be used in addition to project specific fields.'
        ),
        getValue: val => extractMultilineFields(val),
        setValue: val => (val && typeof val.join === 'function' && val.join('\n')) || '',
      },
      {
        name: 'safeFields',
        type: 'string',
        multiline: true,
        placeholder: t('e.g. business-email'),
        label: t('Global safe fields'),
        help: t(
          'Field names which data scrubbers should ignore. Separate multiple entries with a newline.'
        ),
        extraHelp: t(
          'Note: These fields will be used in addition to project specific fields'
        ),
        getValue: val => extractMultilineFields(val),
        setValue: val => (val && typeof val.join === 'function' && val.join('\n')) || '',
      },
      {
        name: 'scrubIPAddresses',
        type: 'boolean',
        label: t('Prevent Storing of IP Addresses'),
        help: t(
          'Preventing IP addresses from being stored for new events on all projects'
        ),
        confirm: {
          false: t(
            'Disabling this can have privacy implications for ALL projects, are you sure you want to continue?'
          ),
        },
      },
    ],
  },
];

export default formGroups;
