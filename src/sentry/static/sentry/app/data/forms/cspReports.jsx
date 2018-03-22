// Export route to make these forms searchable by label/help
import {t} from '../../locale';

export const route = '/settings/:orgId/:projectId/csp/';

const formGroups = [
  {
    // Form "section"/"panel"
    title: 'Settings',
    fields: [
      {
        name: 'sentry:csp_ignored_sources_defaults',
        type: 'boolean',

        label: t('Use default ignored sources'),
        help: t(
          'Our default list will attempt to ignore common issues and reduce noise.'
        ),
        getData: data => ({
          options: data,
        }),
      },

      // XXX: Org details endpoints accept these multiline inputs as a list, where as it looks like project details accepts it as a string with newlines
      {
        name: 'sentry:csp_ignored_sources',
        type: 'string',
        multiline: true,
        placeholder: 'e.g. file://*, *.example.com, example.com, etc...',
        label: t('Additional ignored sources'),
        help: t(
          'Additional field names to match against when scrubbing data for all projects. Separate multiple entries with a newline.'
        ),
        extraHelp: t('Separate multiple entries with a newline.'),
        getData: data => ({
          options: data,
        }),
      },
    ],
  },
];

export default formGroups;
