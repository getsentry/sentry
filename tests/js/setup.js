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

  AccountAppearance: () => {
    return {
      stacktrace_order: '2',
      timezone: 'US/Pacific',
      language: 'en',
      clock_24_hours: true,
    };
  },

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

  Team: params => {
    return {
      id: '1',
      slug: 'team-slug',
      name: 'Team Name',
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
  GitHubIntegrationProvider: params => {
    return {
      key: 'github',
      name: 'GitHub',
      config: [],
      setupUri: '/github-integration-setup-uri/',
      ...params,
    };
  },
  Tags: () => {
    return [{key: 'browser', name: 'Browser'}, {key: 'device', name: 'Device'}];
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
