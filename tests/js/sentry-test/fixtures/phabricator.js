function PhabricatorPlugin() {
  return {
    status: 'unknown',
    description:
      'Integrate Phabricator issue tracking by linking a user account to a project.',
    isTestable: false,
    hasConfiguration: true,
    shortName: 'Phabricator',
    id: 'phabricator',
    assets: [],
    name: 'Phabricator',
    author: {
      url: 'https://github.com/getsentry/sentry',
      name: 'Sentry Team',
    },
    contexts: [],
    doc: '',
    resourceLinks: [
      {
        url: 'https://github.com/getsentry/sentry/issues',
        title: 'Bug Tracker',
      },
      {
        url: 'https://github.com/getsentry/sentry',
        title: 'Source',
      },
    ],
    allowed_actions: ['create', 'link', 'unlink'],
    enabled: true,
    slug: 'phabricator',
    version: '9.1.0.dev0',
    canDisable: true,
    type: 'issue-tracking',
    metadata: {},
  };
}

function PhabricatorCreate() {
  return [
    {
      default: 'ApiException: Authentication failed, token expired!',
      type: 'text',
      name: 'title',
      label: 'Title',
    },
    {
      default:
        'http://dev.getsentry.net:8000/sentry/earth/issues/10/\n\n```\nApiException: Authentication failed, token expired!\n    at io.sentry.example.ApiRequest.perform(ApiRequest.java:8)\n    at io.sentry.example.Sidebar.fetch(Sidebar.java:5)\n    at io.sentry.example.Application.home(Application.java:102)\n...\n(52 additional frame(s) were not displayed)\n\nThis is an example Java exception\n```',
      type: 'textarea',
      name: 'description',
      label: 'Description',
    },
    {
      multi: true,
      name: 'tags',
      type: 'select',
      required: false,
      label: 'Tags',
      has_autocomplete: true,
      placeholder: 'Start typing to search for a project',
    },
    {
      name: 'assignee',
      default: '',
      type: 'select',
      required: false,
      label: 'Assignee',
      has_autocomplete: true,
      placeholder: 'Start typing to search for an assignee',
    },
  ];
}

const DEFAULT_AUTOCOMPLETE_ASSIGNEE = {
  text: 'David Cramer (zeeg)',
  id: 'PHID-USER-53avnyn5r6z6daqjfwdo',
};

const DEFAULT_AUTOCOMPLETE_TAG1 = {text: 'Bar', id: 'PHID-PROJ-biz3qujawd2dfknvhpqv'};
const DEFAULT_AUTOCOMPLETE_TAG2 = {text: 'Foo', id: 'PHID-PROJ-3dfrsmwmavdv4gbg4fxd'};

function PhabricatorAutocomplete(type = 'project', values = null) {
  if (values) {
    return {[type]: values};
  }
  if (type === 'assignee') {
    values = [DEFAULT_AUTOCOMPLETE_ASSIGNEE];
  }
  if (type === 'tags') {
    values = [DEFAULT_AUTOCOMPLETE_TAG1, DEFAULT_AUTOCOMPLETE_TAG2];
  }
  return {[type]: values};
}

export {PhabricatorPlugin, PhabricatorCreate, PhabricatorAutocomplete};
