function VstsPlugin() {
  return {
    status: 'unknown',
    description: 'Integrate Visual Studio Team Services work items by linking a project.',
    isTestable: false,
    hasConfiguration: true,
    shortName: 'VSTS',
    slug: 'vsts',
    name: 'Visual Studio Team Services',
    assets: [],
    title: 'Visual Studio Team Services',
    contexts: [],
    doc: '',
    resourceLinks: [
      {url: 'https://github.com/getsentry/sentry/issues', title: 'Bug Tracker'},
      {url: 'https://github.com/getsentry/sentry', title: 'Source'},
    ],
    allowed_actions: ['create', 'link', 'unlink'],
    enabled: true,
    id: 'vsts',
    version: '9.1.0.dev0',
    canDisable: true,
    author: {url: 'https://github.com/getsentry/sentry', name: 'Sentry Team'},
    type: 'issue-tracking',
    metadata: {},
  };
}

function VstsCreate() {
  return [
    {
      name: 'project',
      default: 'Sentry Testing Team',
      required: true,
      choices: ['Test', 'Sentry Testing'],
      label: 'Project',
      type: 'text',
    },
    {
      default: "TypeError: Cannot read property 'secondsElapsed' of undefined",
      type: 'text',
      name: 'title',
      label: 'Title',
    },
    {
      default:
        "https://sentry.io/sentry-billy/react/issues/590943704/\n\n```\nTypeError: Cannot read property 'secondsElapsed' of undefined\n  at value (/Users/billy/Dev/raven-js-examples/commonjs-react/dist/scripts/app.js:1:4193)\n  at r (/Users/billy/Dev/raven-js-examples/commonjs-react/dist/scripts/app.js:1:17533)\n```",
      type: 'textarea',
      name: 'description',
      label: 'Description',
    },
  ];
}

export {VstsPlugin, VstsCreate};
