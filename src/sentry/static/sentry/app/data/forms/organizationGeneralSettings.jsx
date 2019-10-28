import {extractMultilineFields} from 'app/utils';
import {t} from 'app/locale';
import slugify from 'app/utils/slugify';

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
        help: t('This is the name that users will see for the organization'),
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
        help: t('Require and enforce two-factor authentication for all members'),
        confirm: {
          true: t(
            'This will remove all members without two-factor authentication' +
              ' from your organization. It will also send them an email to setup 2FA' +
              ' and reinstate their access and settings. Do you want to continue?'
          ),
          false: t(
            'Are you sure you want to allow users to access your organization without having two-factor authentication enabled?'
          ),
        },
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
        autosize: true,
        maxRows: 10,
        placeholder: 'e.g. email',
        label: t('Global Sensitive Fields'),
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
        autosize: true,
        maxRows: 10,
        placeholder: t('e.g. business-email'),
        label: t('Global Safe Fields'),
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
      {
        name: 'scrapeJavaScript',
        type: 'boolean',
        confirm: {
          false: t(
            "Are you sure you want to disable sourcecode fetching for JavaScript events? This will affect Sentry's ability to aggregate issues if you're not already uploading sourcemaps as artifacts."
          ),
        },
        label: t('Allow JavaScript Source Fetching'),
        help: t('Allow Sentry to scrape missing JavaScript source context when possible'),
      },
      {
        name: 'storeCrashReports',
        type: 'boolean',
        label: t('Store Native Crash Reports'),
        help: t(
          'Store native crash reports such as Minidumps for improved processing and download in issue details'
        ),
        visible: ({features}) => features.has('event-attachments'),
      },
      {
        name: 'attachmentsRole',
        type: 'array',
        choices: ({initialData} = {}) =>
          (initialData.availableRoles &&
            initialData.availableRoles.map(r => [r.id, r.name])) ||
          [],
        label: t('Attachments Access'),
        help: t(
          'Permissions required to download event attachments, such as native crash reports or log files'
        ),
        visible: ({features}) => features.has('event-attachments'),
      },
      {
        name: 'trustedRelays',
        type: 'string',
        multiline: true,
        autosize: true,
        maxRows: 10,
        placeholder: t('Paste the relay public keys here'),
        label: t('Trusted Relays'),
        help: t(
          'The list of relay public keys that should be trusted. Any relay in this list will be permitted to access org and project configs. Separate multiple entries with a newline.'
        ),
        getValue: val => extractMultilineFields(val),
        setValue: val => (val && typeof val.join === 'function' && val.join('\n')) || '',
        visible: ({features}) => features.has('relay'),
      },
      {
        name: 'allowJoinRequests',
        type: 'boolean',

        label: t('Allow Join Requests'),
        help: t('Allow users to request to join your organization'),
        confirm: {
          true: t(
            'Are you sure you want to allow users to request to join your organization?'
          ),
        },
        visible: ({experiments}) =>
          !!experiments &&
          ['all', 'join_request'].includes(experiments.ImprovedInvitesExperiment),
      },
    ],
  },
];

export default formGroups;
