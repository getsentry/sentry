import jQuery from 'jquery';
import sinon from 'sinon';
import ConfigStore from 'app/stores/configStore';
import MockDate from 'mockdate';
import PropTypes from 'prop-types';

import Enzyme from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

jest.mock('app/translations');
jest.mock('app/api');
jest.mock('scroll-to-element', () => {});

const constantDate = new Date('2017-10-17T04:41:20'); //National Pasta Day
MockDate.set(constantDate);

// We generally use actual jQuery, and jest mocks takes precedence over node_modules
jest.unmock('jquery');

Enzyme.configure({adapter: new Adapter()});
Enzyme.configure({disableLifecycleMethods: true});

window.$ = window.jQuery = jQuery;
window.sinon = sinon;

window.TestStubs = {
  // react-router's 'router' context
  router: () => ({
    push: sinon.spy(),
    replace: sinon.spy(),
    go: sinon.spy(),
    goBack: sinon.spy(),
    goForward: sinon.spy(),
    setRouteLeaveHook: sinon.spy(),
    isActive: sinon.spy(),
    createHref: sinon.spy(),
  }),

  location: () => ({
    query: {},
    pathame: '/mock-pathname/',
  }),

  routerContext: () => ({
    context: {
      location: TestStubs.location(),
      router: TestStubs.router(),
    },
    childContextTypes: {
      router: PropTypes.object,
      location: PropTypes.object,
    },
  }),

  AccountAppearance: () => {
    return {
      stacktrace_order: '2',
      timezone: 'US/Pacific',
      language: 'en',
      clock_24_hours: true,
    };
  },

  ApiKey: params => {
    return {
      allowed_origins: '',
      id: 1,
      key: 'aa624bcc12024702a202cd90be5feda0',
      label: 'Default',
      scope_list: ['project:read', 'event:read', 'team:read', 'member:read'],
      status: 0,
    };
  },

  ApiToken: () => {
    return {
      token: 'apitoken123',
      dateCreated: new Date('Thu Jan 11 2018 18:01:41 GMT-0800 (PST)'),
      scopes: ['scope1', 'scope2'],
    };
  },

  AuthProviders: () => {
    return [['dummy', 'Dummy']];
  },

  AuthProvider: () => {
    return {
      auth_provider: {
        id: '1',
        provider: 'dummy',
      },
      require_link: true,
      default_role: 'member',
      login_url: 'http://loginUrl',
      provider_name: 'dummy',
      pending_links_count: 0,
      content: '',
    };
  },

  AccountEmails: () => {
    return [
      {
        email: 'primary@example.com',
        isPrimary: true,
        isVerified: true,
      },
      {
        email: 'secondary1@example.com',
        isPrimary: false,
        isVerified: true,
      },
      {
        email: 'secondary2@example.com',
        isPrimary: false,
        isVerified: false,
      },
    ];
  },

  GitHubRepositoryProvider: params => {
    return {
      id: 'github',
      name: 'GitHub',
      config: [
        {
          name: 'name',
          label: 'Repository Name',
          type: 'text',
          placeholder: 'e.g. getsentry/sentry',
          help: 'Enter your repository name, including the owner.',
          required: true,
        },
      ],
      ...params,
    };
  },

  GitHubIntegrationProvider: params => {
    return {
      key: 'github',
      name: 'GitHub',
      config: [],
      setupUri: '/github-integration-setup-uri/',
      ...params,
    };
  },

  Integration: params => {
    return {
      id: '4',
      name: 'repo-name',
      provider: {
        key: 'github',
        name: 'GitHub',
      },
      ...params,
    };
  },

  Members: () => [
    {
      id: '1',
      email: '',
      name: '',
      roleName: '',
      pending: false,
      flags: {
        'sso:linked': false,
      },
      user: {
        id: '1',
        has2fa: false,
        name: 'Sentry 1 Name',
        email: 'sentry1@test.com',
        username: 'Sentry 1 Username',
      },
    },
    {
      id: '2',
      email: '',
      name: '',
      roleName: '',
      pending: false,
      flags: {
        'sso:linked': false,
      },
      user: {
        id: '2',
        has2fa: true,
        name: 'Sentry 2 Name',
        email: 'sentry2@test.com',
        username: 'Sentry 2 Username',
      },
    },
    {
      id: '3',
      email: '',
      name: '',
      roleName: '',
      pending: false,
      flags: {
        'sso:linked': true,
      },
      user: {
        id: '3',
        has2fa: true,
        name: 'Sentry 3 Name',
        email: 'sentry3@test.com',
        username: 'Sentry 3 Username',
      },
    },
  ],

  Organization: params => {
    return {
      id: '3',
      slug: 'org-slug',
      name: 'Organization Name',
      access: [
        'org:read',
        'org:write',
        'org:admin',
        'project:read',
        'project:write',
        'project:admin',
        'team:read',
        'team:write',
        'team:admin',
      ],
      status: {
        id: 'active',
        name: 'active',
      },
      features: [],
      onboardingTasks: [],
      teams: [],
      ...params,
    };
  },

  Plugin: params => {
    return {
      author: {url: 'https://github.com/getsentry/sentry', name: 'Sentry Team'},
      enabled: false,
      id: 'amazon-sqs',
      name: 'Amazon SQS',
      slug: 'amazon-sqs',
      version: '8.23.0.dev0',
      assets: [],
      hasConfiguration: true,
      canDisable: true,
      ...params,
    };
  },

  Plugins: () => {
    return [
      {
        author: {url: 'https://github.com/getsentry/sentry', name: 'Sentry Team'},
        enabled: false,
        id: 'amazon-sqs',
        name: 'Amazon SQS',
        slug: 'amazon-sqs',
        version: '8.23.0.dev0',
        assets: [],
        hasConfiguration: true,
        canDisable: true,
      },
      {
        author: {url: 'https://github.com/getsentry/sentry', name: 'Sentry Team'},
        enabled: true,
        id: 'github',
        name: 'GitHub',
        slug: 'github',
        version: '8.23.0.dev0',
        assets: [],
        canDisable: false,
      },
    ];
  },

  Project: params => {
    return {
      id: '2',
      slug: 'project-slug',
      name: 'Project Name',
      subjectTemplate: '[$project] ${tag:level}: $title',
      digestsMinDelay: 5,
      digestsMaxDelay: 60,
      ...params,
    };
  },

  Repository: params => {
    return {
      id: '4',
      name: 'repo-name',
      provider: 'github',
      url: 'https://github.com/example/repo-name',
      status: 'active',
      ...params,
    };
  },

  Searches: params => [
    {
      name: 'Needs Triage',
      dateCreated: '2017-11-14T02:22:58.026Z',
      isUserDefault: false,
      isPrivate: false,
      query: 'is:unresolved is:unassigned',
      id: '2',
      isDefault: true,
    },
    {
      name: 'Unresolved Issues',
      dateCreated: '2017-11-14T02:22:58.022Z',
      isUserDefault: true,
      isPrivate: false,
      query: 'is:unresolved',
      id: '1',
      isDefault: false,
    },
  ],

  Subscriptions: () => {
    return [
      {
        subscribedDate: '2018-01-08T05:14:59.102Z',
        subscribed: true,
        listDescription:
          'Everything you need to know about Sentry features, integrations, partnerships, and launches.',
        listId: 2,
        unsubscribedDate: null,
        listName: 'Product & Feature Updates',
        email: 'test@sentry.io',
      },
      {
        subscribedDate: null,
        subscribed: false,
        listDescription:
          "Our monthly update on what's new with Sentry and the community.",
        listId: 1,
        unsubscribedDate: '2018-01-08T19:31:42.546Z',
        listName: 'Sentry Newsletter',
        email: 'test@sentry.io',
      },
    ];
  },

  Tags: () => {
    return [
      {key: 'browser', name: 'Browser', canDelete: true},
      {key: 'device', name: 'Device', canDelete: true},
      {key: 'environment', name: 'Environment', canDelete: false},
    ];
  },

  Team: params => {
    return {
      id: '1',
      slug: 'team-slug',
      name: 'Team Name',
      ...params,
    };
  },
};

// this is very commonly used, so expose it globally
window.MockApiClient = require.requireMock('app/api').Client;

// default configuration
ConfigStore.loadInitialData({
  user: {
    isAuthenticated: true,
    email: 'foo@example.com',
    options: {
      timezone: 'UTC',
    },
  },
});
