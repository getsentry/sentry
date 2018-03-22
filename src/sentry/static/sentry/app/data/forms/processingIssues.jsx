// Export route to make these forms searchable by label/help
import {t} from '../../locale';

export const route = '/settings/:orgId/:projectId/processing-issues/';

const formGroups = [
  {
    // Form "section"/"panel"
    title: 'Settings',
    fields: [
      {
        name: 'sentry:reprocessing_active',
        type: 'boolean',
        label: t('Reprocessing active'),
        disabled: ({access}) => !access.has('project:write'),
        disabledReason: t('Only admins may change reprocessing settings'),
        help: t(`If reprocessing is enabled, Events with fixable issues will be
                held back until you resolve them. Processing issues will then
                show up in the list above with hints how to fix them.
                If reprocessing is disabled Events with unresolved issues will also
                show up in the stream.
                `),
        getData: form => ({
          options: form,
        }),
      },
    ],
  },
];

export default formGroups;
