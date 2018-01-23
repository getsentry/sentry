import timezones from '../timezones';
import languages from '../languages';

// Export route to make these forms searchable by label/help
export const route = '/settings/account/appearance/';

const formGroups = [
  {
    // Form "section"/"panel"
    title: 'Events',
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
      },
    ],
  },

  {
    title: 'Localization',
    fields: [
      {
        name: 'language',
        type: 'choice',
        label: 'Language',
        // seems weird to have choices in initial form data
        choices: languages,
      },
      {
        name: 'timezone',
        type: 'choice',
        label: 'Timezone',
        choices: timezones,
      },
      {
        name: 'clock24Hours',
        type: 'boolean',
        label: 'Use a 24-hour clock',
      },
    ],
  },
];

export default formGroups;
