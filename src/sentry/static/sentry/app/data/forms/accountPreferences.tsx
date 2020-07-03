import timezones from 'app/data/timezones';
import languages from 'app/data/languages';
import {JsonFormObject} from 'app/views/settings/components/forms/type';
import {t} from 'app/locale';

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
        name: 'stacktraceOrder',
        type: 'choice',
        required: false,
        choices: [
          ['-1', t('Default (let Sentry decide)')],
          ['1', t('Most recent call last')],
          ['2', t('Most recent call first')],
        ],
        label: t('Stacktrace Order'),
        help: t('Choose the default ordering of frames in stacktraces'),
        getData: transformOptions,
      },
      {
        name: 'language',
        type: 'choice',
        label: t('Language'),
        choices: languages,
        getData: transformOptions,
      },
      {
        name: 'timezone',
        type: 'choice',
        label: t('Timezone'),
        choices: timezones,
        getData: transformOptions,
      },
      {
        name: 'clock24Hours',
        type: 'boolean',
        label: t('Use a 24-hour clock'),
        getData: transformOptions,
      },
    ],
  },
];

export default formGroups;
