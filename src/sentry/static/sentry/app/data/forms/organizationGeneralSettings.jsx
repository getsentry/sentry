import {createSearchMap} from './util';
import {extractMultilineFields} from '../../utils';

const forms = [
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
        choices: ({data}) => data.availableRoles.map(r => [r.id, r.name]),
        help: 'The default role new members will receive.',
        getValue: (val, {access}) => (access.has('org:admin') ? val : undefined),
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

export default forms;

// generate search index from form fields
export const searchIndex = createSearchMap({
  route: '/settings/organization/:orgId/settings/',
  requireParams: ['orgId'],
  formGroups: forms,
});

// need to associate index -> form group -> route
// so when we search for a term we need to find:
//   * what field(s) it matches:
//     * what form group it belongs to
//     * what route that belongs to
