import jQuery from 'jquery';
import sinon from 'sinon';
import ConfigStore from 'app/stores/configStore';
import MockDate from 'mockdate';
import PropTypes from 'prop-types';
import SentryTypes from 'app/proptypes';
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
      organization: TestStubs.Organization(),
    },
    childContextTypes: {
      router: PropTypes.object,
      location: PropTypes.object,
      organization: PropTypes.object,
    },
  }),

  routerOrganizationContext: () => ({
    context: {
      location: TestStubs.location(),
      router: TestStubs.router(),
      organization: TestStubs.Organization(),
    },
    childContextTypes: {
      router: PropTypes.object,
      location: PropTypes.object,
      organization: SentryTypes.Organization,
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

  Authenticators: () => {
    return {
      Totp: params => ({
        lastUsedAt: null,
        enrollButton: 'Enroll',
        description:
          'An authenticator application that supports TOTP (like Google Authenticator or 1Password) can be used to conveniently secure your account.  A new token is generated every 30 seconds.',
        isEnrolled: true,
        removeButton: 'Remove',
        id: 'totp',
        createdAt: '2018-01-30T17:24:36.554Z',
        configureButton: 'Info',
        name: 'Authenticator App',
        allowMultiEnrollment: false,
        authId: '15',
        canValidateOtp: true,
        isBackupInterface: false,
        ...params,
      }),
      Sms: params => ({
        enrollButton: 'Enroll',
        name: 'Text Message',
        allowMultiEnrollment: false,
        removeButton: 'Remove',
        canValidateOtp: true,
        isEnrolled: false,
        configureButton: 'Info',
        id: 'sms',
        isBackupInterface: false,
        description:
          "This authenticator sends you text messages for verification.  It's useful as a backup method or when you do not have a phone that supports an authenticator application.",
        ...params,
      }),
      U2f: params => ({
        lastUsedAt: null,
        enrollButton: 'Enroll',
        description:
          "Authenticate with a U2F hardware device. This is a device like a Yubikey or something similar which supports FIDO's U2F specification. This also requires a browser which supports this system (like Google Chrome).",
        isEnrolled: true,
        removeButton: 'Remove',
        id: 'u2f',
        createdAt: '2018-01-30T20:56:45.932Z',
        configureButton: 'Configure',
        name: 'U2F (Universal 2nd Factor)',
        allowMultiEnrollment: true,
        authId: '23',
        canValidateOtp: false,
        isBackupInterface: false,
        ...params,
      }),
      Recovery: params => ({
        lastUsedAt: null,
        enrollButton: 'Activate',
        description:
          'Recovery codes can be used to access your account in the event you lose access to your device and cannot receive two-factor authentication codes.',
        isEnrolled: true,
        removeButton: null,
        id: 'recovery',
        createdAt: '2018-01-30T17:24:36.570Z',
        configureButton: 'View Codes',
        name: 'Recovery Codes',
        allowMultiEnrollment: false,
        authId: '16',
        canValidateOtp: true,
        isBackupInterface: true,
        ...params,
      }),
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

  DebugSymbols: params => ({
    debugSymbols: [
      {
        dateAdded: '2018-01-31T07:16:26.072Z',
        dsym: {
          headers: {'Content-Type': 'text/x-proguard+plain'},
          sha1: 'e6d3c5185dac63eddfdc1a5edfffa32d46103b44',
          uuid: '6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1',
          objectName: 'proguard-mapping',
          dateCreated: '2018-01-31T07:16:26.010Z',
          cpuName: 'any',
          id: '1',
          symbolType: 'proguard',
          size: 212,
        },
        dsymAppId: 1,
        version: '1.0',
        build: '1',
        id: '1',
      },
    ],
    unreferencedDebugSymbols: [],
    apps: [
      {
        lastSync: '2018-01-31T07:16:26.070Z',
        name: 'MyApp',
        iconUrl: null,
        platforms: '',
        platform: 'android',
        appId: 'com.example.myapp',
        id: '1',
      },
    ],
    ...params,
  }),

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

  Group: () => {
    return {
      id: '1',
      stats: {
        '24h': [[1517281200, 2], [1517310000, 1]],
        '30d': [[1514764800, 1], [1515024000, 122]],
      },
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

  ProjectAlertRule: () => {
    return {
      id: '1',
    };
  },

  ProjectAlertRuleConfiguration: () => {
    return {
      actions: [
        {
          html: 'Send a notification for all services',
          id: 'sentry.rules.actions.notify1',
          label: 'Send a notification for all services',
        },
      ],
      conditions: [
        {
          html: 'An event is seen',
          id: 'sentry.rules.conditions.1',
          label: 'An event is seen',
        },
      ],
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
      projects: [],
      ...params,
    };
  },

  UserDetails: params => ({
    username: 'billyfirefoxusername@test.com',
    emails: [
      {is_verified: false, id: '20', email: 'billyfirefox@test.com2'},
      {is_verified: true, id: '8', email: 'billyfirefox2@test.com'},
      {is_verified: false, id: '7', email: 'billyfirefox@test.com'},
    ],
    isManaged: false,
    lastActive: '2018-01-25T21:00:19.946Z',
    identities: [],
    id: '4',
    isActive: true,
    has2fa: false,
    name: 'Firefox Billy',
    avatarUrl:
      'https://secure.gravatar.com/avatar/5df53e28e63099658c1ba89b8e9a7cf4?s=32&d=mm',
    authenticators: [],
    dateJoined: '2018-01-11T00:30:41.366Z',
    options: {
      timezone: 'UTC',
      seenReleaseBroadcast: null,
      stacktraceOrder: 'default',
      language: 'en',
      clock24Hours: false,
    },
    avatar: {avatarUuid: null, avatarType: 'letter_avatar'},
    lastLogin: '2018-01-25T19:57:46.973Z',
    permissions: [],
    email: 'billyfirefox@test.com',
    ...params,
  }),
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
