import {extractMultilineFields} from '../../utils';

// Export route to make these forms searchable by label/help
export const route = '/settings/organization/:orgId/settings/';

const formGroups = [
  {
    // Form "section"/"panel"
    title: 'General',
    fields: [
      {
        name: 'name',
        type: 'string',
        required: true,

        // additional data/props that is related to rendering of form field rather than data
        label: 'Name',
        help: 'The name of your organization. e.g. My Company',
      },
      {
        name: 'slug',
        type: 'string',
        required: true,
        label: 'Short Name',
        help: 'A unique ID used to identify this organization.',
      },
      {
        name: 'isEarlyAdopter',
        type: 'boolean',
        label: 'Early Adopter',
        help: "Opt-in to new features before they're released to the public.",
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
        label: 'Default Role',
        // seems weird to have choices in initial form data
        choices: ({initialData} = {}) =>
          (initialData.availableRoles &&
            initialData.availableRoles.map(r => [r.id, r.name])) ||
          [],
        help: 'The default role new members will receive.',
        disabled: ({access}) => !access.has('org:admin'),
      },
      {
        name: 'openMembership',
        type: 'boolean',
        required: true,
        label: 'Open Membership',
        help: 'Allow organization members to freely join or leave any team.',
      },
    ],
  },

  {
    title: 'Security & Privacy',
    fields: [
      {
        name: 'allowSharedIssues',
        type: 'boolean',

        label: 'Allow Shared Issues',
        help: 'Enable sharing of limited details on issues to anonymous users.',
      },
      {
        name: 'enhancedPrivacy',
        type: 'boolean',

        label: 'Enhanced Privacy',
        help:
          'Enable enhanced privacy controls to limit personally identifiable information (PII) as well as source code in things like notifications.',
      },
      {
        name: 'dataScrubber',
        type: 'boolean',
        label: 'Require Data Scrubber',
        help: 'Require server-side data scrubbing be enabled for all projects.',
      },
      {
        name: 'dataScrubberDefaults',
        type: 'boolean',

        required: true,
        label: 'Require Using Default Scrubbers',
        help:
          'Require the default scrubbers be applied to prevent things like passwords and credit cards from being stored for all projects.',
      },
      {
        name: 'sensitiveFields',
        type: 'string',
        multiline: true,
        placeholder: 'e.g. email',
        label: 'Global sensitive fields',
        help:
          'Additional field names to match against when scrubbing data for all projects. Separate multiple entries with a newline.',
        extraHelp:
          'Note: These fields will be used in addition to project specific fields.',
        getValue: val => extractMultilineFields(val),
        setValue: val => (val && typeof val.join === 'function' && val.join('\n')) || '',
      },
      {
        name: 'safeFields',
        type: 'string',
        multiline: true,
        placeholder: 'e.g. business-email',
        label: 'Global safe fields',
        help:
          'Field names which data scrubbers should ignore. Separate multiple entries with a newline.',
        extraHelp:
          'Note: These fields will be used in addition to project specific fields.',
        getValue: val => extractMultilineFields(val),
        setValue: val => (val && typeof val.join === 'function' && val.join('\n')) || '',
      },
      {
        name: 'scrubIPAddresses',
        type: 'boolean',
        label: 'Prevent Storing of IP Addresses',
        help: 'Preventing IP addresses from being stored for new events on all projects.',
      },
    ],
  },
];

export default formGroups;
