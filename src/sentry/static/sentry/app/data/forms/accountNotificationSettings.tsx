import {t, tct} from 'app/locale';
import {Field, JsonFormObject} from 'app/views/settings/components/forms/type';

// Export route to make these forms searchable by label/help
export const route = '/settings/account/notifications/';

export const fields: {[key: string]: Field} = {
  subscribeByDefault: {
    name: 'subscribeByDefault',
    type: 'boolean',
    label: t('Send Me Alerts'),
    // TODO(billy): Make this a real link
    help: tct(
      'Alerts are defined in [locationPath]. Enable this to receive alerts sent to your teams. You will always receive alerts configured to be sent directly to you.',
      {
        locationPath: '[Project] » Project Settings » Alerts',
      }
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

const formGroups: JsonFormObject[] = [
  {
    title: t('Alerts'),
    fields: [fields.subscribeByDefault],
  },

  {
    title: t('Workflow Notifications'),
    fields: [fields.workflowNotifications],
  },

  {
    title: t('Email Routing'),
    fields: [],
  },

  {
    title: t('Weekly Reports'),
    fields: [],
  },

  {
    title: t('Deploy Notifications'),
    fields: [fields.deployNotifications],
  },

  {
    title: t('My Activity'),
    fields: [fields.personalActivityNotifications, fields.selfAssignOnResolve],
  },
];

export default formGroups;
