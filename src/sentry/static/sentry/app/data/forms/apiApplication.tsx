import {extractMultilineFields} from 'app/utils';
import getDynamicText from 'app/utils/getDynamicText';
import {JsonFormObject} from 'app/views/settings/components/forms/type';

const forms: JsonFormObject[] = [
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
        setValue: value => getDynamicText({value, fixed: 'PERCY_APPLICATION_NAME'}),
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
