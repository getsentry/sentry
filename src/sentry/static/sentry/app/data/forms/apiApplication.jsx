// import {createSearchMap} from './util';
import {extractMultilineFields} from '../../utils';

const forms = [
  {
    // Form "section"/"panel"
    title: 'Application Details',
    fields: [
      {
        name: 'name',
        type: 'string',
        required: true,

        // additional data/props that is related to rendering of form field rather than data
        label: 'Name',
        help: 'e.g. My Application',
      },
      {
        name: 'homepageUrl',
        type: 'string',
        required: false,
        label: 'Homepage',
        placeholder: 'e.g. https://example.com/',
        help: "An optional link to your application's homepage",
      },
      {
        name: 'privacyUrl',
        type: 'string',
        label: 'Privacy Policy',
        placeholder: 'e.g. https://example.com/privacy',
        help: 'An optional link to your Privacy Policy',
      },
      {
        name: 'termsUrl',
        type: 'string',
        label: 'Terms of Service',
        placeholder: 'e.g. https://example.com/terms',
        help: 'An optional link to your Terms of Service agreement',
      },
    ],
  },

  {
    title: 'Security',
    fields: [
      {
        name: 'redirectUris',
        type: 'string',
        multiline: true,
        placeholder: 'e.g. https://example.com/oauth/complete',
        label: 'Authorized Redirect URIs',
        help: 'Separate multiple entries with a newline.',
        getValue: val => extractMultilineFields(val),
        setValue: val => (val && typeof val.join === 'function' && val.join('\n')) || '',
      },
      {
        name: 'allowedOrigins',
        type: 'string',
        multiline: true,
        placeholder: 'e.g. example.com',
        label: 'Authorized JavaScript Origins',
        help: 'Separate multiple entries with a newline.',
        getValue: val => extractMultilineFields(val),
        setValue: val => (val && typeof val.join === 'function' && val.join('\n')) || '',
      },
    ],
  },
];

export default forms;

// generate search index from form fields
// export const searchIndex = createSearchMap({
// route: '/settings/organization/:orgId/settings/',
// requireParams: ['orgId'],
// formGroups: forms,
// });

// need to associate index -> form group -> route
// so when we search for a term we need to find:
//   * what field(s) it matches:
//     * what form group it belongs to
//     * what route that belongs to
