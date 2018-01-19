import {extractMultilineFields} from '../../utils';

// Export route to make these forms searchable by label/help
export const route = '/settings/organization/:orgId/project/:projectId/settings/';

const formGroups = [
  {
    // Form "section"/"panel"
    title: 'Project Details',
    fields: [
      {
        name: 'name',
        type: 'string',
        required: true,

        // additional data/props that is related to rendering of form field rather than data
        label: 'Project Name',
        placeholder: 'My Service Name',
        help: 'The name of your project',
      },
      {
        name: 'slug',
        type: 'string',
        required: true,
        label: 'Short Name',
        placeholder: 'my-service-name',
        help: 'A unique ID used to identify this project',
      },
      {
        name: 'team',
        type: 'array',
        label: 'Team',
        choices: ({organization}) =>
          organization.teams.filter(o => o.isMember).map(o => [o.id, o.slug]),
        help: "Opt-in to new features before they're released to the public.",
      },
    ],
  },

  {
    title: 'Email',
    fields: [
      {
        name: 'subjectPrefix',
        type: 'string',
        label: 'Subject Prefix',
        help: 'Choose a custom prefix for emails from this project',
      },
    ],
  },

  {
    title: 'Event Settings',
    fields: [
      {
        name: 'defaultEnvironment',
        type: 'string',
        label: 'Default Environment',
        placeholder: 'production',
        help: 'The default selected environment when viewing issues',
      },
      {
        name: 'resolveAge',
        type: 'number',

        min: 0,
        max: 168,
        step: 1,
        label: 'Auto Resolve',
        help:
          "Automatically resolve an issue if it hasn't been seen for this amount of time",
      },
    ],
  },

  {
    title: 'Data Privacy',
    fields: [
      {
        name: 'dataScrubber',
        type: 'boolean',
        label: 'Data Scrubber',
        help: 'Enable server-side data scrubbing',
      },
      {
        name: 'dataScrubberDefaults',
        type: 'boolean',

        label: 'Use Default Scrubbers',
        help:
          'Apply default scrubbers to prevent things like passwords and credit cards from being stored',
      },
      {
        name: 'sensitiveFields',
        type: 'string',
        multiline: true,
        placeholder: 'email',
        label: 'Additional Sensitive Fields',
        help:
          'Additional field names to match against when scrubbing data. Separate multiple entries with a newline',
        getValue: val => extractMultilineFields(val),
        setValue: val => (val && typeof val.join === 'function' && val.join('\n')) || '',
      },
      {
        name: 'safeFields',
        type: 'string',
        multiline: true,
        placeholder: 'business-email',
        label: 'Safe Fields',
        help:
          'Field names which data scrubbers should ignore. Separate multiple entries with a newline',
        getValue: val => extractMultilineFields(val),
        setValue: val => (val && typeof val.join === 'function' && val.join('\n')) || '',
      },
      {
        name: 'scrubIPAddresses',
        type: 'boolean',
        label: "Don't Store IP Addresses",
        help: 'Preventing IP addresses from being stored for new events',
      },
    ],
  },

  {
    title: 'Client Security',
    fields: [
      {
        name: 'allowedDomains',
        type: 'string',
        multiline: true,
        placeholder: 'https://example.com or example.com',
        label: 'Allowed Domains',
        help: 'Separate multiple entries with a newline',
        getValue: val => extractMultilineFields(val),
        setValue: val => (val && typeof val.join === 'function' && val.join('\n')) || '',
      },
      {
        name: 'scrapeJavaScript',
        type: 'boolean',
        label: 'Enable JavaScript source fetching',
        help: 'Allow Sentry to scrape missing JavaScript source context when possible',
      },
      {
        name: 'securityToken',
        type: 'string',
        label: 'Security Token',
        help:
          'Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended',
      },
      {
        name: 'securityTokenHeader',
        type: 'string',
        placeholder: 'X-Sentry-Token',
        label: 'Security Token Header',
        help:
          'Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended.',
      },
      {
        name: 'verifySSL',
        type: 'boolean',
        label: 'Verify TLS/SSL',
        help: 'Outbound requests will verify TLS (sometimes known as SSL) connections.',
      },
    ],
  },
];

export default formGroups;
