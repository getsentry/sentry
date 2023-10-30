import {Field} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';

// TODO: cleanup unused fields and exports

// Export route to make these forms searchable by label/help
export const route = '/settings/account/notifications/';

export const fields: {[key: string]: Field} = {
  subscribeByDefault: {
    name: 'subscribeByDefault',
    type: 'boolean',
    label: t('Send Me Alerts'),
    // TODO(billy): Make this a real link
    help: t(
      'Enable this to receive notifications for Alerts sent to your teams. You will always receive alerts configured to be sent directly to you.'
    ),
  },
  workflowNotifications: {
    name: 'workflowNotifications',
    type: 'radio',
    label: t('Send Me Workflow Notifications'),
    choices: [
      [0, t('Always')],
      [1, t('Only On Issues I Subscribe To')],
      [2, t('Never')],
    ],
    help: t('E.g. changes in issue assignment, resolution status, and comments.'),
  },
  weeklyReports: {
    // Form is not visible because currently not implemented
    name: 'weeklyReports',
    type: 'boolean',
    label: t('Send Me Weekly Reports'),
    help: t("Reports contain a summary of what's happened within your organization."),
    disabled: true,
  },
  deployNotifications: {
    name: 'deployNotifications',
    type: 'radio',
    label: t('Send Me Deploy Notifications'),
    choices: [
      [2, t('Always')],
      [3, t('Only On Deploys With My Commits')],
      [4, t('Never')],
    ],
    help: t('Deploy emails include release, environment and commit overviews.'),
  },
  personalActivityNotifications: {
    name: 'personalActivityNotifications',
    type: 'boolean',
    label: t('Notify Me About My Own Activity'),
    help: t('Enable this to receive notifications about your own actions on Sentry.'),
  },
  selfAssignOnResolve: {
    name: 'selfAssignOnResolve',
    type: 'boolean',
    label: t("Claim Unassigned Issues I've Resolved"),
    help: t("You'll receive notifications about any changes that happen afterwards."),
  },
};
