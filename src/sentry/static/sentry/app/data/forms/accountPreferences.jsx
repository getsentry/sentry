import timezones from 'app/data/timezones';
import languages from 'app/data/languages';

// Export route to make these forms searchable by label/help
export const route = '/settings/account/details/';

// Called before sending API request, these fields need to be sent as an `options` object
const transformOptions = data => ({options: data});

const formGroups = [
  {
    // Form "section"/"panel"
    title: 'Preferences',
    fields: [
      {
        name: 'stacktraceOrder',
        type: 'choice',
        required: false,
        choices: [
          ['-1', 'Default (let Sentry decide)'],
          ['1', 'Most recent call last'],
          ['2', 'Most recent call first'],
        ],

        // additional data/props that is related to rendering of form field rather than data
        label: 'Stacktrace Order',
        help: 'Choose the default ordering of frames in stacktraces',
        getData: transformOptions,
      },
      {
        name: 'language',
        type: 'choice',
        label: 'Language',
        // seems weird to have choices in initial form data
        choices: languages,
        getData: transformOptions,
      },
      {
        name: 'timezone',
        type: 'choice',
        label: 'Timezone',
        choices: timezones,
        getData: transformOptions,
      },
      {
        name: 'clock24Hours',
        type: 'boolean',
        label: 'Use a 24-hour clock',
        getData: transformOptions,
      },
    ],
  },
];

export default formGroups;
