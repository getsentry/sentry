const forms = [
  {
    title: 'Alerts',
    fields: [
      {
        name: 'projectAlerts',
        type: 'boolean',
        required: true,
        label: 'Send Me Project Alerts',
        help: 'Alerts are defined in [Project] » Project Settings » Alerts » Rules.',
      }
    ],
  },

  {
    title: 'Workflow Notifications',
    fields: [
      {
        name: 'weeklyReports',
        type: 'boolean',
        label: 'Send Me Weekly Reports',
        help: "Reports contain a summary of what's happened within your organization.",
      }
    ]
  }
];

export default forms;
