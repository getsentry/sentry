import {t, tct} from '../../locale';

// Export route to make these forms searchable by label/help
export const route = '/settings/account/notifications/';

const formGroups = [
  {
    title: t('Alerts'),
    fields: [
      {
        name: 'subscribeByDefault',
        type: 'boolean',
        label: t('Send Me Project Alerts'),
        // TODO(billy): Make this a real link
        help: tct('Alerts are defined in [locationPath]', {
          locationPath: '[Project] » Project Settings » Alerts » Rules.',
        }),
      },
    ],
  },

  {
    title: t('Workflow Notifications'),
    fields: [
      {
        name: 'workflowNotifications',
        type: 'radio',
        label: t('Send Me Workflow Notifications'),
        choices: [[0, 'Always'], [1, 'Only On Issues I Subscribe To'], [2, 'Never']],
        help: t('E.g. changes in issue assignment, resolution status, and comments.'),
      },
    ],
  },

  {
    title: t('Email Routing'),
    fields: [],
  },

  {
    title: t('Weekly Reports'),
    fields: [
      {
        name: 'weeklyReports',
        type: 'boolean',
        label: t('Send Me Weekly Reports'),
        help: t("Reports contain a summary of what's happened within your organization."),
        disabled: true,
      },
    ],
  },

  {
    title: t('Deploy Notifications'),
    fields: [
      {
        name: 'deployNotifications',
        type: 'radio',
        label: t('Send Me Deploy Notifications'),
        choices: [[2, 'Always'], [3, 'Only On Deploys With My Commits'], [4, 'Never']],
        help: t('Deploy emails include release, environment and commit overviews.'),
      },
    ],
  },

  {
    title: t('My Activity'),
    fields: [
      {
        name: 'personalActivityNotifications',
        type: 'boolean',
        label: t('Notify Me About My Own Activity'),
        help: t('Enable this to recieve notifications about your own actions on Sentry.'),
      },
      {
        name: 'selfAssignOnResolve',
        type: 'boolean',
        label: t("Claim Unassigned Issues I've Resolved"),
        help: t("You'll recieve notifications about any changes that happen afterwards."),
      },
    ],
  },
];

export default formGroups;
