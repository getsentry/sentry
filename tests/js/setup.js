import jQuery from 'jquery';
import sinon from 'sinon';
import ConfigStore from 'app/stores/configStore';

jest.mock('app/translations');
jest.mock('app/api');

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
    createHref: sinon.spy()
  }),
  location: () => ({
    query: {},
    pathame: '/mock-pathname/'
  }),

  ApiKey: (...params) => {
    return {
      allowed_origins: '',
      id: 1,
      key: 'aa624bcc12024702a202cd90be5feda0',
      label: 'Default',
      scope_list: ['project:read', 'event:read', 'team:read', 'member:read'],
      status: 0
    };
  },

  AuthProviders: () => {
    return [['dummy', 'Dummy']];
  },

  AuthProvider: () => {
    return {
      auth_provider: {
        id: '1',
        provider: 'dummy'
      },
      require_link: true,
      default_role: 'member',
      login_url: 'http://loginUrl',
      provider_name: 'dummy',
      pending_links_count: 0,
      content: ''
    };
  },

  Team: (...params) => {
    return {
      id: '1',
      slug: 'team-slug',
      name: 'Team Name',
      ...params
    };
  },
  Project: (...params) => {
    return {
      id: '2',
      slug: 'project-slug',
      name: 'Project Name',
      subjectTemplate: '[$project] ${tag:level}: $title',
      digestsMinDelay: 5,
      digestsMaxDelay: 60,
      ...params
    };
  },
  Organization: (...params) => {
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
        'team:admin'
      ],
      features: [],
      onboardingTasks: [],
      teams: [],
      ...params
    };
  },
  Repository: (...params) => {
    return {
      id: '4',
      name: 'repo-name',
      provider: 'github',
      url: 'https://github.com/example/repo-name',
      status: 'visible',
      ...params
    };
  },
  GitHubRepositoryProvider: (...params) => {
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
          required: true
        }
      ],
      ...params
    };
  },
  Integration: (...params) => {
    return {
      id: '4',
      name: 'repo-name',
      provider: {
        id: 'github',
        name: 'GitHub'
      },
      ...params
    };
  },
  GitHubIntegrationProvider: (...params) => {
    return {
      id: 'github',
      name: 'GitHub',
      config: [],
      setupUri: '/github-integration-setup-uri/',
      ...params
    };
  }
};

// this is very commonly used, so expose it globally
window.MockApiClient = require.requireMock('app/api').Client;

// default configuration
ConfigStore.loadInitialData({
  user: {
    isAuthenticated: true,
    email: 'foo@example.com',
    options: {
      timezone: 'UTC'
    }
  }
});
