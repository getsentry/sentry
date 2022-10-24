import {JsonFormObject} from 'sentry/components/forms/types';
import languages from 'sentry/data/languages';
import timezones from 'sentry/data/timezones';
import {t} from 'sentry/locale';

// Export route to make these forms searchable by label/help
export const route = '/settings/account/details/';

// Called before sending API request, these fields need to be sent as an
// `options` object
const transformOptions = (data: object) => ({options: data});

const formGroups: JsonFormObject[] = [
  {
    // Form "section"/"panel"
    title: 'Preferences',
    fields: [
      {
        name: 'theme',
        type: 'select',
        label: t('Theme'),
        help: t(
          "Select your theme preference. It can be synced to your system's theme, always light mode, or always dark mode."
        ),
        options: [
          {value: 'light', label: t('Light')},
          {value: 'dark', label: t('Dark')},
          {value: 'system', label: t('Default to system')},
        ],
        getData: transformOptions,
      },
      {
        name: 'language',
        type: 'select',
        label: t('Language'),
        options: languages.map(([value, label]) => ({value, label})),
        getData: transformOptions,
      },
      {
        name: 'timezone',
        type: 'select',
        label: t('Timezone'),
        options: timezones.map(([value, label]) => ({value, label})),
        getData: transformOptions,
      },
      {
        name: 'clock24Hours',
        type: 'boolean',
        label: t('Use a 24-hour clock'),
        getData: transformOptions,
      },
      {
        name: 'stacktraceOrder',
        type: 'select',
        required: false,
        options: [
          {value: -1, label: t('Default (let Sentry decide)')},
          {value: 1, label: t('Most recent call last')},
          {value: 2, label: t('Most recent call first')},
        ],
        label: t('Stack Trace Order'),
        help: t('Choose the default ordering of frames in stack traces'),
        getData: transformOptions,
      },
    ],
  },
];

export default formGroups;
