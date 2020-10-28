function AsanaPlugin() {
  return {
    status: 'unknown',
    description: 'Integrate Asana issues by linking a repository to a project.',
    isTestable: false,
    hasConfiguration: true,
    shortName: 'Asana',
    slug: 'asana',
    name: 'Asana',
    assets: [],
    title: 'Asana',
    contexts: [],
    doc: '',
    resourceLinks: [
      {url: 'https://github.com/getsentry/sentry/issues', title: 'Bug Tracker'},
      {url: 'https://github.com/getsentry/sentry', title: 'Source'},
    ],
    allowed_actions: ['create', 'link', 'unlink'],
    enabled: true,
    id: 'asana',
    version: '9.1.0.dev0',
    canDisable: true,
    author: {url: 'https://github.com/getsentry/sentry', name: 'Sentry Team'},
    type: 'issue-tracking',
    metadata: {},
  };
}

function AsanaCreate() {
  return [
    {
      name: 'workspace',
      default: 608780875677549,
      choices: [[608780875677549, 'sentry.io']],
      readonly: true,
      label: 'Asana Workspace',
      type: 'select',
    },
    {
      default: 'Error: Loading chunk 3 failed.',
      type: 'text',
      name: 'title',
      label: 'Name',
    },
    {
      default:
        'http://localhost:8000/default/internal/issues/3750/\n\n```\nError: Loading chunk 3 failed.\n  at HTMLScriptElement.onScriptComplete (/_static/1529684704/sentry/dist/vendor.js:762:24)\n```',
      required: false,
      type: 'textarea',
      name: 'description',
      label: 'Notes',
    },
    {
      name: 'project',
      placeholder: 'Start typing to search for a project',
      required: false,
      has_autocomplete: true,
      label: 'Project',
      type: 'select',
    },
    {
      name: 'assignee',
      placeholder: 'Start typing to search for a user',
      required: false,
      has_autocomplete: true,
      label: 'Assignee',
      type: 'select',
    },
  ];
}

const DEFAULT_AUTOCOMPLETE = {text: '(#724210387969378) billy', id: 724210387969378};
function AsanaAutocomplete(type = 'project', values = [DEFAULT_AUTOCOMPLETE]) {
  return {[type]: values};
}

export {AsanaPlugin, AsanaCreate, AsanaAutocomplete};
