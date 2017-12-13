const forms = [
  {
    title: 'Alerts',
    fields: [
      {
        name: 'projectAlerts',
        type: 'boolean',
        label: 'Send Me Project Alerts',
        help: 'Alerts are defined in [Project] » Project Settings » Alerts » Rules.',
      },
    ],
  },

  {
    title: 'Workflow Notifications',
    fields: [
      {
        name: 'workflowNotifications',
        type: 'radio',
        label: 'Send Me Workflow Notifications',
        choices: () => [
          [0, 'Always'],
          [1, 'Only On Issues I Subscribe To'],
          [2, 'Never'],
        ],
        help: 'E.g. changes in issue assignment, resolution status, and comments.',
      },
    ],
  },

  {
    title: 'Weekly Reports',
    fields: [
      {
        name: 'weeklyReports',
        type: 'boolean',
        label: 'Send Me Weekly Reports',
        help: "Reports contain a summary of what's happened within your organization.",
      },
    ],
  },

  {
    title: 'Deploy Notifications',
    fields: [
      {
        name: 'deployNotifications',
        type: 'radio',
        label: 'Send Me Deploy Notifications',
        choices: () => [
          [0, 'Always'],
          [1, 'Only On Deploys With My Commits'],
          [2, 'Never'],
        ],
        help: 'Deploy emails include release, environment and commit overviews.',
      },
    ],
  },

  {
    title: 'My Activity',
    fields: [
      {
        name: 'personalActivity',
        type: 'boolean',
        label: 'Notify Me About My Own Activity',
        help: 'Enable this to recieve notifications about your own actions on Sentry.',
      },
      {
        name: 'claimUnassignedIssues',
        type: 'boolean',
        label: "Claim Unassigned Issues I've Resolved",
        help: "You'll recieve notifications about any changes that happen afterwords.",
      },
    ],
  },
];

export default forms;
