import {JsonFormObject} from 'sentry/components/forms/type';
import {t} from 'sentry/locale';
import {convertMultilineFieldValue, extractMultilineFields} from 'sentry/utils';
import {
  formatStoreCrashReports,
  getStoreCrashReportsValues,
  SettingScope,
} from 'sentry/utils/crashReports';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/security-and-privacy/';
export default [
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
        name: 'requireEmailVerification',
        type: 'boolean',
        label: t('Require Email Verification'),
        help: t('Require and enforce email address verification for all members'),
        visible: ({features}) => features.has('required-email-verification'),
        confirm: {
          true: t(
            'This will remove all members whose email addresses are not verified' +
              ' from your organization. It will also send them an email to verify their address' +
              ' and reinstate their access and settings. Do you want to continue?'
          ),
          false: t(
            'Are you sure you want to allow users to access your organization without verifying their email address?'
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
        type: 'select',
        label: t('Store Native Crash Reports'),
        help: t(
          'Store native crash reports such as Minidumps for improved processing and download in issue details'
        ),
        visible: ({features}) => features.has('event-attachments'),
        // HACK: some organization can have limit of stored crash reports a number that's not in the options (legacy reasons),
        // we therefore display it in a placeholder
        placeholder: ({value}) => formatStoreCrashReports(value),
        choices: () =>
          getStoreCrashReportsValues(SettingScope.Organization).map(value => [
            value,
            formatStoreCrashReports(value),
          ]),
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
        visible: ({hasSsoEnabled}) => !hasSsoEnabled,
      },
    ],
  },
  {
    title: t('Data Scrubbing'),
    fields: [
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
        rows: 1,
        placeholder: 'e.g. email',
        label: t('Global Sensitive Fields'),
        help: t(
          'Additional field names to match against when scrubbing data for all projects. Separate multiple entries with a newline.'
        ),
        extraHelp: t(
          'Note: These fields will be used in addition to project specific fields.'
        ),
        getValue: val => extractMultilineFields(val),
        setValue: val => convertMultilineFieldValue(val),
      },
      {
        name: 'safeFields',
        type: 'string',
        multiline: true,
        autosize: true,
        maxRows: 10,
        rows: 1,
        placeholder: t('e.g. business-email'),
        label: t('Global Safe Fields'),
        help: t(
          'Field names which data scrubbers should ignore. Separate multiple entries with a newline.'
        ),
        extraHelp: t(
          'Note: These fields will be used in addition to project specific fields'
        ),
        getValue: val => extractMultilineFields(val),
        setValue: val => convertMultilineFieldValue(val),
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
] as JsonFormObject[];
