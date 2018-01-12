import {createSearchMap} from './util';
import timezones from '../timezones';
import languages from '../languages';

const forms = [
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

export default forms;

// generate search index from form fields
export const searchIndex = createSearchMap({
  route: '/settings/account/appearance/',
  formGroups: forms,
});

// need to associate index -> form group -> route
// so when we search for a term we need to find:
//   * what field(s) it matches:
//     * what form group it belongs to
//     * what route that belongs to
