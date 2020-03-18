// Export route to make these forms searchable by label/help
import {t} from 'app/locale';
import {JsonFormObject} from 'app/views/settings/components/forms/type';

export const route = '/settings/:orgId/projects/:projectId/csp/';

const formGroups: JsonFormObject[] = [
  {
    // Form "section"/"panel"
    title: 'CSP Settings',
    fields: [
      {
        name: 'sentry:csp_ignored_sources_defaults',
        type: 'boolean',

        label: t('Use default ignored sources'),
        help: t(
          'Our default list will attempt to ignore common issues and reduce noise.'
        ),
        getData: data => ({options: data}),
      },

      // XXX: Org details endpoints accept these multiline inputs as a list,
      // where as it looks like project details accepts it as a string with newlines
      {
        name: 'sentry:csp_ignored_sources',
        type: 'string',
        multiline: true,
        autosize: true,
        placeholder: 'e.g.\nfile://*\n*.example.com\nexample.com',
        label: t('Additional ignored sources'),
        help: t(
          'Discard reports about requests from the given sources. Separate multiple entries with a newline.'
        ),
        extraHelp: t('Separate multiple entries with a newline.'),
        getData: data => ({options: data}),
      },
    ],
  },
];

export default formGroups;
