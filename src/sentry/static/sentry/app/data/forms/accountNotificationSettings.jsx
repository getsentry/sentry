// Export route to make these forms searchable by label/help
export const route = '/settings/account/notifications/';

const formGroups = [
  {
    title: 'Alerts',
    fields: [
      {
        name: 'subscribeByDefault',
        type: 'boolean',
        label: 'Send Me Project Alerts',
        help: 'Alerts are defined in [Project] » Project Settings » Alerts » Rules.',
      },
    ],
    fineTuning: {
      text: 'Fine tune alerts by project',
      path: 'project-alerts/',
    },
  },

  {
    title: 'Workflow Notifications',
    fields: [
      {
        name: 'workflowNotifications',
        type: 'radio',
        label: 'Send Me Workflow Notifications',
        choices: [[0, 'Always'], [1, 'Only On Issues I Subscribe To'], [2, 'Never']],
        help: 'E.g. changes in issue assignment, resolution status, and comments.',
      },
    ],
    fineTuning: {
      text: 'Fine tune workflow notifications by project',
      path: 'workflow-notifications/',
    },
  },

  {
    title: 'Weekly Reports',
    fields: [
      {
        name: 'weeklyReports',
        type: 'boolean',
        label: 'Send Me Weekly Reports',
        help: "Reports contain a summary of what's happened within your organization.",
        disabled: true,
      },
    ],
    fineTuning: {
      text: 'Fine tune weekly reports by organization',
      path: 'weekly-reports/',
    },
  },

  {
    title: 'Deploy Notifications',
    fields: [
      {
        name: 'deployNotifications',
        type: 'radio',
        label: 'Send Me Deploy Notifications',
        choices: [[2, 'Always'], [3, 'Only On Deploys With My Commits'], [4, 'Never']],
        help: 'Deploy emails include release, environment and commit overviews.',
      },
    ],
    fineTuning: {
      text: 'Fine tune deploy notifications by organization',
      path: 'deploy-notifications/',
    },
  },

  {
    title: 'My Activity',
    fields: [
      {
        name: 'personalActivityNotifications',
        type: 'boolean',
        label: 'Notify Me About My Own Activity',
        help: 'Enable this to recieve notifications about your own actions on Sentry.',
      },
      {
        name: 'selfAssignOnResolve',
        type: 'boolean',
        label: "Claim Unassigned Issues I've Resolved",
        help: "You'll recieve notifications about any changes that happen afterwards.",
      },
    ],
  },
];

export default formGroups;
