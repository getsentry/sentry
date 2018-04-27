import {t, tct} from 'app/locale';

// Export route to make these forms searchable by label/help
export const route = '/settings/account/notifications/';

export const fields = {
  subscribeByDefault: {
    name: 'subscribeByDefault',
    type: 'boolean',
    label: t('Send Me Project Alerts'),
    // TODO(billy): Make this a real link
    help: tct('Alerts are defined in [locationPath]', {
      locationPath: '[Project] » Project Settings » Alerts » Rules.',
    }),
  },
  workflowNotifications: {
    name: 'workflowNotifications',
    type: 'radio',
    label: t('Send Me Workflow Notifications'),
    choices: [[0, 'Always'], [1, 'Only On Issues I Subscribe To'], [2, 'Never']],
    help: t('E.g. changes in issue assignment, resolution status, and comments.'),
  },
  weeklyReports: {
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
    choices: [[2, 'Always'], [3, 'Only On Deploys With My Commits'], [4, 'Never']],
    help: t('Deploy emails include release, environment and commit overviews.'),
  },
  personalActivityNotifications: {
    name: 'personalActivityNotifications',
    type: 'boolean',
    label: t('Notify Me About My Own Activity'),
    help: t('Enable this to recieve notifications about your own actions on Sentry.'),
  },
  selfAssignOnResolve: {
    name: 'selfAssignOnResolve',
    type: 'boolean',
    label: t("Claim Unassigned Issues I've Resolved"),
    help: t("You'll recieve notifications about any changes that happen afterwards."),
  },
};

const formGroups = [
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
    fields: [fields.weeklyReports],
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
