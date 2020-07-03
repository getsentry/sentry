import {t, tn} from 'app/locale';
import {Field} from 'app/views/settings/components/forms/type';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/projects/:projectId/alerts/';

const formatMinutes = (value: number | '') => {
  value = Number(value) / 60;
  return tn('%s minute', '%s minutes', value);
};

export const fields: {[key: string]: Field} = {
  subjectTemplate: {
    name: 'subjectTemplate',
    type: 'string',

    // additional data/props that is related to rendering of form field rather than data
    label: t('Subject Template'),
    placeholder: 'e.g. $shortID - $title',
    help: t(
      'The email subject to use (excluding the prefix) for individual alerts. Usable variables include: $title, $shortID, $projectID, $orgID, and ${tag:key}, such as ${tag:environment} or ${tag:release}.'
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
