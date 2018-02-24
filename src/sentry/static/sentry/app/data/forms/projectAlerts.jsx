import {t} from '../../locale';

// Export route to make these forms searchable by label/help
export const route = '/settings/organization/:orgId/project/:projectId/alerts/';

const formatMinutes = value => {
  value = value / 60;
  return `${value} minute${value != 1 ? 's' : ''}`;
};

const formGroups = [
  {
    // Form "section"/"panel"
    title: t('Email Settings'),
    fields: [
      {
        name: 'subjectTemplate',
        type: 'string',

        // additional data/props that is related to rendering of form field rather than data
        label: t('Subject Template'),
        placeholder: 'e.g. [${tag:environment}]',
        help: t(
          'The email subject to use (excluding the prefix) for individual alerts. Usable variables include: $project, $title, $shortID, and ${tag:key}, such as ${tag:environment} or ${tag:release}.'
        ),
      },
    ],
  },

  {
    // Form "section"/"panel"
    title: t('Digests'),
    fields: [
      {
        name: 'digestsMinDelay',
        type: 'range',
        min: 60,
        max: 3600,
        step: 60,
        defaultValue: 300,
        label: t('Minimum delivery interval'),
        help: t('Notifications will be delivered at most this often.'),
        formatLabel: formatMinutes,
      },
      {
        name: 'digestsMaxDelay',
        type: 'range',
        min: 60,
        max: 3600,
        step: 60,
        defaultValue: 300,
        label: t('Maximum delivery interval'),
        help: t('Notifications will be delivered at least this often.'),
        formatLabel: formatMinutes,
      },
    ],
  },
];

export default formGroups;
