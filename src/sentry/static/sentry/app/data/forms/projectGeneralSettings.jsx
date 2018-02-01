import {extractMultilineFields} from '../../utils';
import {t} from '../../locale';

// Export route to make these forms searchable by label/help
export const route = '/settings/organization/:orgId/project/:projectId/settings/';

const formGroups = [
  {
    // Form "section"/"panel"
    title: t('Project Details'),
    fields: [
      {
        name: 'name',
        type: 'string',
        required: true,

        // additional data/props that is related to rendering of form field rather than data
        label: t('Project Name'),
        placeholder: t('My Service Name'),
        help: t('The name of your project'),
      },
      {
        name: 'slug',
        type: 'string',
        required: true,
        label: t('Short Name'),
        placeholder: t('my-service-name'),
        help: t('A unique ID used to identify this project'),
      },
      {
        name: 'team',
        type: 'array',
        label: t('Team'),
        choices: ({organization}) =>
          organization.teams.filter(o => o.isMember).map(o => [o.id, o.slug]),
        help: t("Opt-in to new features before they're released to the public."),
      },
    ],
  },

  {
    title: t('Email'),
    fields: [
      {
        name: 'subjectPrefix',
        type: 'string',
        label: t('Subject Prefix'),
        help: t('Choose a custom prefix for emails from this project'),
      },
    ],
  },

  {
    title: t('Event Settings'),
    fields: [
      {
        name: 'defaultEnvironment',
        type: 'string',
        label: t('Default Environment'),
        placeholder: t('production'),
        help: t('The default selected environment when viewing issues'),
      },
      {
        name: 'resolveAge',
        type: 'number',

        min: 0,
        max: 168,
        step: 1,
        label: t('Auto Resolve'),
        help: t(
          "Automatically resolve an issue if it hasn't been seen for this amount of time"
        ),
      },
    ],
  },

  {
    title: t('Data Privacy'),
    fields: [
      {
        name: 'dataScrubber',
        type: 'boolean',
        label: t('Data Scrubber'),
        help: t('Enable server-side data scrubbing'),
      },
      {
        name: 'dataScrubberDefaults',
        type: 'boolean',

        label: t('Use Default Scrubbers'),
        help: t(
          'Apply default scrubbers to prevent things like passwords and credit cards from being stored'
        ),
      },
      {
        name: 'sensitiveFields',
        type: 'string',
        multiline: true,
        placeholder: t('email'),
        label: t('Additional Sensitive Fields'),
        help: t(
          'Additional field names to match against when scrubbing data. Separate multiple entries with a newline'
        ),
        getValue: val => extractMultilineFields(val),
        setValue: val => (val && typeof val.join === 'function' && val.join('\n')) || '',
      },
      {
        name: 'safeFields',
        type: 'string',
        multiline: true,
        placeholder: t('business-email'),
        label: t('Safe Fields'),
        help: t(
          'Field names which data scrubbers should ignore. Separate multiple entries with a newline'
        ),
        getValue: val => extractMultilineFields(val),
        setValue: val => (val && typeof val.join === 'function' && val.join('\n')) || '',
      },
      {
        name: 'scrubIPAddresses',
        type: 'boolean',
        label: t("Don't Store IP Addresses"),
        help: t('Preventing IP addresses from being stored for new events'),
      },
    ],
  },

  {
    title: t('Client Security'),
    fields: [
      {
        name: 'allowedDomains',
        type: 'string',
        multiline: true,
        placeholder: t('https://example.com or example.com'),
        label: t('Allowed Domains'),
        help: t('Separate multiple entries with a newline'),
        getValue: val => extractMultilineFields(val),
        setValue: val => (val && typeof val.join === 'function' && val.join('\n')) || '',
      },
      {
        name: 'scrapeJavaScript',
        type: 'boolean',
        label: t('Enable JavaScript source fetching'),
        help: t('Allow Sentry to scrape missing JavaScript source context when possible'),
      },
      {
        name: 'securityToken',
        type: 'string',
        label: t('Security Token'),
        help: t(
          'Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended'
        ),
      },
      {
        name: 'securityTokenHeader',
        type: 'string',
        placeholder: t('X-Sentry-Token'),
        label: t('Security Token Header'),
        help: t(
          'Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended.'
        ),
      },
      {
        name: 'verifySSL',
        type: 'boolean',
        label: t('Verify TLS/SSL'),
        help: t(
          'Outbound requests will verify TLS (sometimes known as SSL) connections.'
        ),
      },
    ],
  },
];

export default formGroups;
