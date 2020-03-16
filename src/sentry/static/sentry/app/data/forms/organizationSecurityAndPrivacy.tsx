import React from 'react';

import {extractMultilineFields} from 'app/utils';
import {t, tct} from 'app/locale';
import {
  STORE_CRASH_REPORTS_VALUES,
  formatStoreCrashReports,
} from 'app/utils/crashReports';
import {JsonFormObject} from 'app/views/settings/components/forms/type';

const organizationSecurityAndPrivacy: Array<JsonFormObject> = [
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
        name: 'relayPiiConfig',
        type: 'string',
        label: t('Advanced datascrubber configuration'),
        placeholder: t('Paste a JSON configuration here.'),
        multiline: true,
        monospace: true,
        autosize: true,
        inline: false,
        maxRows: 20,
        help: tct(
          'Advanced JSON-based configuration for datascrubbing. Applied in addition to the settings above. This list of rules can be extended on a per-project level, but never overridden. [learn_more:Learn more]',
          {
            learn_more: (
              <a href="https://docs.sentry.io/data-management/advanced-datascrubbing/" />
            ),
          }
        ),
        visible: ({features}) => features.has('datascrubbers-v2'),
        validate: ({id, form}) => {
          if (form[id] === '') {
            return [];
          }
          try {
            JSON.parse(form[id]);
          } catch (e) {
            return [[id, e.toString().replace(/^SyntaxError: JSON.parse: /, '')]];
          }
          return [];
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
        type: 'range',
        label: t('Store Native Crash Reports'),
        help: t(
          'Store native crash reports such as Minidumps for improved processing and download in issue details'
        ),
        visible: ({features}) => features.has('event-attachments'),
        allowedValues: STORE_CRASH_REPORTS_VALUES,
        formatLabel: formatStoreCrashReports,
      },
      {
        name: 'attachmentsRole',
        type: 'array',
        choices: ({initialData = {}}) =>
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
        visible: ({hasSsoEnabled}) => !hasSsoEnabled,
      },
    ],
  },
];

export default organizationSecurityAndPrivacy;
