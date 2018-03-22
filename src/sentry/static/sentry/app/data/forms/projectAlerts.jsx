import {t, tn} from '../../locale';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/:projectId/alerts/';

const formatMinutes = value => {
  value = value / 60;
  return tn('%d minute', '%d minutes', value);
};

export const fields = {
  subjectTemplate: {
    name: 'subjectTemplate',
    type: 'string',

    // additional data/props that is related to rendering of form field rather than data
    label: t('Subject Template'),
    placeholder: 'e.g. [${tag:environment}]',
    help: t(
      'The email subject to use (excluding the prefix) for individual alerts. Usable variables include: $project, $title, $shortID, and ${tag:key}, such as ${tag:environment} or ${tag:release}.'
    ),
  },
  digestsMinDelay: {
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
  digestsMaxDelay: {
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
};
