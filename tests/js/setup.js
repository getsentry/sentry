import {channel, createBroadcast} from 'emotion-theming';
import jQuery from 'jquery';
import sinon from 'sinon';
import Adapter from 'enzyme-adapter-react-16';
import Enzyme from 'enzyme';
import MockDate from 'mockdate';
import PropTypes from 'prop-types';

import ConfigStore from 'app/stores/configStore';
import theme from 'app/utils/theme';

import RoleList from './fixtures/roleList';
import Release from './fixtures/release';
import {AsanaPlugin, AsanaCreate, AsanaAutocomplete} from './fixtures/asana';
import {
  PhabricatorPlugin,
  PhabricatorCreate,
  PhabricatorAutocomplete,
} from './fixtures/phabricator';
import {VstsPlugin, VstsCreate} from './fixtures/vsts-old';

jest.mock('lodash/debounce', () => jest.fn(fn => fn));
jest.mock('app/utils/recreateRoute');
jest.mock('app/translations');
jest.mock('app/api');
jest.mock('scroll-to-element', () => {});
jest.mock('react-router', () => {
  const ReactRouter = require.requireActual('react-router');
  return {
    IndexRedirect: ReactRouter.IndexRedirect,
    IndexRoute: ReactRouter.IndexRoute,
    Link: ReactRouter.Link,
    Redirect: ReactRouter.Redirect,
    Route: ReactRouter.Route,
    withRouter: ReactRouter.withRouter,
    browserHistory: {
      push: jest.fn(),
      replace: jest.fn(),
      listen: jest.fn(() => {}),
    },
  };
});
jest.mock('react-lazyload', () => {
  const LazyLoadMock = ({children}) => children;
  return LazyLoadMock;
});

jest.mock('app/utils/sdk', () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
  showReportDialog: jest.fn(),
  lastEventId: jest.fn(),
}));

const constantDate = new Date(1508208080000); //National Pasta Day
MockDate.set(constantDate);

// We generally use actual jQuery, and jest mocks takes precedence over node_modules
jest.unmock('jquery');

Enzyme.configure({adapter: new Adapter()});
Enzyme.configure({disableLifecycleMethods: true});

// This is so we can use async/await in tests instead of wrapping with `setTimeout`
window.tick = () => new Promise(resolve => setTimeout(resolve));

window.$ = window.jQuery = jQuery;
window.sinon = sinon;
window.scrollTo = jest.fn();

// emotion context broadcast
const broadcast = createBroadcast(theme);

window.TestStubs = {
  // react-router's 'router' context
  router: (params = {}) => ({
    push: jest.fn(),
    replace: jest.fn(),
    go: jest.fn(),
    goBack: jest.fn(),
    goForward: jest.fn(),
    listen: jest.fn(),
    setRouteLeaveHook: jest.fn(),
    isActive: jest.fn(),
    createHref: jest.fn(),
    location: {query: {}},
    ...params,
  }),

  location: (params = {}) => ({
    query: {},
    pathame: '/mock-pathname/',
    ...params,
  }),

  routes: () => [
    {path: '/'},
    {path: '/:orgId/'},
    {name: 'this should be skipped'},
    {path: '/organizations/:orgId/'},
    {path: 'api-keys/', name: 'API Key'},
  ],

  routerProps: (params = {}) => ({
    location: TestStubs.location(),
    params: {},
    routes: [],
    stepBack: () => {},
    ...params,
  }),

  routerContext: ([context, childContextTypes] = []) => ({
    context: {
      [channel]: {
        subscribe: broadcast.subscribe,
        unsubscribe: broadcast.unsubscribe,
      },
      location: TestStubs.location(),
      router: TestStubs.router(),
      organization: TestStubs.Organization(),
      project: TestStubs.Project(),
      ...context,
    },
    childContextTypes: {
      [channel]: PropTypes.object,
      router: PropTypes.object,
      location: PropTypes.object,
      organization: PropTypes.object,
      project: PropTypes.object,
      ...childContextTypes,
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

  AuditLogs: () => [
    {
      note: 'edited project ludic-science',
      targetObject: 2,
      targetUser: null,
      data: {
        status: 0,
        slug: 'ludic-science',
        public: false,
        name: 'Ludic Science',
        id: 2,
      },
      dateCreated: '2018-02-21T03:04:23.157Z',
      ipAddress: '127.0.0.1',
      id: '465',
      actor: {
        username: 'billy@sentry.io',
        emails: [
          {is_verified: true, id: '5', email: 'billy@sentry.io'},
          {is_verified: false, id: '17', email: 'billy36@sentry.io'},
          {is_verified: false, id: '11', email: 'awerawer@awe.com'},
          {is_verified: false, id: '28', email: 'test@test.com'},
          {is_verified: true, id: '10', email: 'billy2@sentry.io'},
        ],
        isManaged: false,
        lastActive: '2018-02-21T17:40:31.555Z',
        identities: [
          {
            name: '79684',
            dateVerified: '2018-02-21T17:09:46.248Z',
            provider: {id: 'github', name: 'GitHub'},
            dateSynced: '2018-02-21T17:09:46.248Z',
            organization: {slug: 'default', name: 'default'},
            id: '1',
          },
        ],
        id: '1',
        isActive: true,
        has2fa: true,
        name: 'billy vong',
        avatarUrl:
          'https://secure.gravatar.com/avatar/7b544e8eb9d08ed777be5aa82121155a?s=32&d=mm',
        dateJoined: '2018-01-10T00:19:59Z',
        options: {
          timezone: 'America/Los_Angeles',
          seenReleaseBroadcast: true,
          stacktraceOrder: -1,
          language: 'en',
          clock24Hours: false,
        },
        avatar: {
          avatarUuid: '483ed7478a2248d59211f538c2997e0b',
          avatarType: 'letter_avatar',
        },
        lastLogin: '2018-02-14T07:09:37.536Z',
        permissions: [],
        email: 'billy@sentry.io',
      },
      event: 'project.edit',
    },
    {
      note: 'edited the organization setting(s): accountRateLimit from 1000 to 0',
      targetObject: 2,
      targetUser: null,
      data: {accountRateLimit: 'from 1000 to 0'},
      dateCreated: '2018-02-16T23:45:59.813Z',
      ipAddress: '127.0.0.1',
      id: '408',
      actor: {
        username: 'billy@sentry.io',
        emails: [
          {is_verified: true, id: '5', email: 'billy@sentry.io'},
          {is_verified: false, id: '17', email: 'billy36@sentry.io'},
          {is_verified: false, id: '11', email: 'awerawer@awe.com'},
          {is_verified: false, id: '28', email: 'test@test.com'},
          {is_verified: true, id: '10', email: 'billy2@sentry.io'},
        ],
        isManaged: false,
        lastActive: '2018-02-21T17:40:31.555Z',
        identities: [
          {
            name: '79684',
            dateVerified: '2018-02-21T17:09:46.248Z',
            provider: {id: 'github', name: 'GitHub'},
            dateSynced: '2018-02-21T17:09:46.248Z',
            organization: {slug: 'default', name: 'default'},
            id: '1',
          },
        ],
        id: '1',
        isActive: true,
        has2fa: true,
        name: 'billy vong',
        avatarUrl:
          'https://secure.gravatar.com/avatar/7b544e8eb9d08ed777be5aa82121155a?s=32&d=mm',
        dateJoined: '2018-01-10T00:19:59Z',
        options: {
          timezone: 'America/Los_Angeles',
          seenReleaseBroadcast: true,
          stacktraceOrder: -1,
          language: 'en',
          clock24Hours: false,
        },
        avatar: {
          avatarUuid: '483ed7478a2248d59211f538c2997e0b',
          avatarType: 'letter_avatar',
        },
        lastLogin: '2018-02-14T07:09:37.536Z',
        permissions: [],
        email: 'billy@sentry.io',
      },
      event: 'org.edit',
    },
  ],

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
          'Recovery codes are the only way to access your account if you lose your device and cannot receive two-factor authentication codes.',
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
        codes: ['ABCD-1234', 'EFGH-5678'],
        ...params,
      }),
    };
  },

  AllAuthenticators: () => {
    return Object.values(TestStubs.Authenticators()).map(x => x());
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

  Broadcast: params => ({
    dateCreated: new Date(),
    dateExpires: new Date(),
    hasSeen: false,
    id: '8',
    isActive: true,
    link:
      'https://docs.sentry.io/hosted/clients/javascript/sourcemaps/#uploading-source-maps-to-sentry',
    message:
      'Source maps are JSON files that contain information on how to map your transpiled source code back to their original source.',
    title: 'Learn about Source Maps',
    ...params,
  }),

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

  Environments: hidden => {
    if (hidden) {
      return [{id: '1', name: 'zzz', isHidden: true}];
    } else {
      return [
        {id: '1', name: 'production', isHidden: false},
        {id: '2', name: 'staging', isHidden: false},
      ];
    }
  },

  Event: params => {
    return {
      id: '1',
      message: 'ApiException',
      groupID: '1',
      eventID: '12345678901234567890123456789012',
      ...params,
    };
  },

  EventIdQueryResult: params => {
    let event = TestStubs.Event({
      metadata: {
        type: 'event type',
        value: 'event description',
      },
    });
    return {
      organizationSlug: 'org-slug',
      projectSlug: 'project-slug',
      groupId: event.groupID,
      eventId: event.eventID,
      event,
    };
  },

  Events: () => {
    return [
      TestStubs.Event({eventID: '12345', id: '1', message: 'ApiException', groupID: '1'}),
      TestStubs.Event({
        eventID: '12346',
        id: '2',
        message: 'TestException',
        groupID: '1',
      }),
    ];
  },

  GitHubRepositoryProvider: params => {
    return {
      key: 'github',
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
      canAdd: true,
      canAddProject: false,
      config: [],
      externalIssues: [],
      features: [],
      setupDialog: {
        url: '/github-integration-setup-uri/',
        width: 100,
        height: 100,
      },
      metadata: {
        description: '*markdown* formatted _description_',
        author: 'Morty',
        noun: 'Installation',
        issue_url: 'http://example.com/integration_issue_url',
        source_url: 'http://example.com/integration_source_url',
        aspects: {
          alerts: [
            {
              type: 'warning',
              text: 'This is a an alert example',
            },
          ],
        },
      },
      ...params,
    };
  },

  JiraIntegrationProvider: params => {
    return {
      key: 'jira',
      name: 'Jira',
      canAdd: false,
      canAddProject: true,
      config: [],
      features: [],
      metadata: {
        description: '*markdown* formatted Jira _description_',
        author: 'Rick',
        noun: 'Instance',
        issue_url: 'http://example.com/jira_integration_issue_url',
        source_url: 'http://example.com/jira_integration_source_url',
        aspects: {
          externalInstall: {
            url: 'http://jira.com',
            buttonText: 'Visit Jira',
            noticeText: 'You must visit jira to install the integration',
          },
        },
      },
      ...params,
    };
  },

  GitHubIntegration: params => {
    return {
      domainName: 'gtithub.com/test-integration',
      icon: 'http://example.com/integration_icon.png',
      id: '1',
      name: 'Test Integration',
      provider: {
        name: 'GitHub',
        key: 'github',
        canAdd: true,
        canAddProject: false,
        features: [],
      },
      projects: [],
      configOrganization: [],
      configProject: [],
      configData: {},
      ...params,
    };
  },

  JiraIntegration: params => {
    return {
      domainName: 'jira.com/test-integration',
      icon: 'http://jira.example.com/integration_icon.png',
      id: '2',
      name: 'Jira Test Integration',
      provider: {
        name: 'Jira',
        key: 'jira',
        canAdd: true,
        canAddProject: true,
        features: [],
      },
      projects: [],
      configOrganization: [],
      configProject: [],
      configData: {},
      ...params,
    };
  },

  Group: params => {
    let project = TestStubs.Project();
    return {
      id: '1',
      stats: {
        '24h': [[1517281200, 2], [1517310000, 1]],
        '30d': [[1514764800, 1], [1515024000, 122]],
      },
      project: {
        id: project.id,
        slug: project.slug,
      },
      tags: [],
      assignedTo: null,
      ...params,
    };
  },

  Incident: params => ({
    id: '1',
    title: 'Test Incident',
    updates: ['First Update', 'Second Update'],
    url: 'https://status.sentry.io',
  }),

  Member: params => ({
    id: '1',
    email: 'sentry1@test.com',
    name: 'Sentry 1 Name',
    role: 'member',
    roleName: 'Member',
    pending: false,
    flags: {
      'sso:linked': false,
    },
    user: TestStubs.User(),
    ...params,
  }),

  Members: () => [
    TestStubs.Member(),
    {
      id: '2',
      name: 'Sentry 2 Name',
      email: 'sentry2@test.com',
      role: 'member',
      roleName: 'Member',
      pending: true,
      flags: {
        'sso:linked': false,
      },
      user: {
        id: '2',
        has2fa: false,
        name: 'Sentry 2 Name',
        email: 'sentry2@test.com',
        username: 'Sentry 2 Username',
      },
    },
    {
      id: '3',
      name: 'Sentry 3 Name',
      email: 'sentry3@test.com',
      role: 'owner',
      roleName: 'Owner',
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
    {
      id: '4',
      name: 'Sentry 4 Name',
      email: 'sentry4@test.com',
      role: 'owner',
      roleName: 'Owner',
      pending: false,
      flags: {
        'sso:linked': true,
      },
      user: {
        id: '4',
        has2fa: true,
        name: 'Sentry 4 Name',
        email: 'sentry4@test.com',
        username: 'Sentry 4 Username',
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
      scrapeJavaScript: true,
      features: [],
      onboardingTasks: [],
      teams: [],
      projects: [],
      ...params,
    };
  },

  Organizations: params => {
    return [
      {
        id: '1',
        name: 'test 1',
        slug: 'test 1',
        require2FA: false,
        status: {
          id: 'active',
          name: 'active',
        },
        ...params,
      },
      {
        id: '2',
        name: 'test 2',
        slug: 'test 2',
        require2FA: false,
        status: {
          id: 'active',
          name: 'active',
        },
        ...params,
      },
    ];
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
      hasAccess: true,
      isMember: true,
      isBookmarked: false,
      teams: [],
      ...params,
    };
  },

  ProjectDetails: params => {
    return TestStubs.Project({
      subjectTemplate: '[$project] ${tag:level}: $title',
      subjectPrefix: '[my-org]',
      digestsMinDelay: 5,
      digestsMaxDelay: 60,
      dataScrubber: false,
      dataScrubberDefaults: false,
      scrubIPAddresses: false,
      resolveAge: 48,
      sensitiveFields: ['creditcard', 'ssn'],
      safeFields: ['business-email', 'company'],
      allowedDomains: ['example.com', 'https://example.com'],
      scrapeJavaScript: true,
      securityToken: 'security-token',
      securityTokenHeader: 'x-security-header',
      verifySSL: true,
      features: [],
      ...params,
    });
  },

  ProjectAlertRule: () => {
    return {
      id: '1',
      name: 'My alert rule',
      environment: 'staging',
      conditions: [{name: 'An alert is first seen', id: 'sentry.rules.conditions.1'}],
      actions: [
        {name: 'Send a notification to all services', id: 'sentry.rules.actions.notify1'},
      ],
    };
  },

  ProjectAlertRuleConfiguration: () => {
    return {
      actions: [
        {
          id: 'sentry.rules.actions.notify1',
          label: 'Send a notification for all services',
          enabled: true,
        },
      ],
      conditions: [
        {
          id: 'sentry.rules.conditions.1',
          label: 'An event is seen',
          enabled: true,
        },
      ],
    };
  },

  ProjectFilters: params => [
    {
      active: true,
      id: 'browser-extensions',
      name: 'Filter out errors known to be caused by browser extensions',
      description:
        'Certain browser extensions will inject inline scripts and are known to cause errors.',
    },
    {
      active: false,
      id: 'localhost',
      name: 'Filter out events coming from localhost',
      description:
        'This applies to both IPv4 (``127.0.0.1``) and IPv6 (``::1``) addresses.',
    },
    {
      active: ['ie_pre_9', 'ie9'],
      id: 'legacy-browsers',
      name: 'Filter out known errors from legacy browsers',
      description:
        'Older browsers often give less accurate information, and while they may report valid issues, the context to understand them is incorrect or missing.',
    },
    {
      active: false,
      id: 'web-crawlers',
      name: 'Filter out known web crawlers',
      description:
        'Some crawlers may execute pages in incompatible ways which then cause errors that are unlikely to be seen by a normal user.',
    },
  ],

  ProjectKeys: () => {
    return [
      {
        dsn: {
          secret:
            'http://188ee45a58094d939428d8585aa6f661:a33bf9aba64c4bbdaf873bb9023b6d2d@dev.getsentry.net:8000/1',
          minidump:
            'http://dev.getsentry.net:8000/api/1/minidump?sentry_key=188ee45a58094d939428d8585aa6f661',
          public: 'http://188ee45a58094d939428d8585aa6f661@dev.getsentry.net:8000/1',
          csp:
            'http://dev.getsentry.net:8000/api/1/csp-report/?sentry_key=188ee45a58094d939428d8585aa6f661',
          security:
            'http://dev.getsentry.net:8000/api/1/security-report/?sentry_key=188ee45a58094d939428d8585aa6f661',
        },
        public: '188ee45a58094d939428d8585aa6f661',
        secret: 'a33bf9aba64c4bbdaf873bb9023b6d2d',
        name: 'Natural Halibut',
        rateLimit: null,
        projectId: 1,
        dateCreated: '2018-02-28T07:13:51.087Z',
        id: '188ee45a58094d939428d8585aa6f661',
        isActive: true,
        label: 'Natural Halibut',
      },
    ];
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

  Release,

  RoleList,

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

  ShortIdQueryResult: params => {
    let group = TestStubs.Group({
      metadata: {
        type: 'group type',
        value: 'group description',
      },
    });
    return {
      organizationSlug: 'org-slug',
      projectSlug: 'project-slug',
      groupId: group.id,
      shortId: 'test-1',
      group,
    };
  },

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
      {key: 'url', name: 'URL', canDelete: true},
      {key: 'environment', name: 'Environment', canDelete: false},
    ];
  },

  Team: params => {
    return {
      id: '1',
      slug: 'team-slug',
      name: 'Team Name',
      isMember: true,
      ...params,
    };
  },

  Tombstones: params => [
    {
      culprit: 'poll(../../sentry/scripts/views.js)',
      level: 'error',
      actor: {
        username: 'billy@sentry.io',
        emails: [
          {is_verified: false, id: '28', email: 'test@test.com'},
          {is_verified: false, id: '17', email: 'billy36@sentry.io'},
          {is_verified: false, id: '11', email: 'awerawer@awe.com'},
          {is_verified: true, id: '10', email: 'billy2@sentry.io'},
          {is_verified: true, id: '5', email: 'billy@sentry.io'},
        ],
        isManaged: false,
        lastActive: '2018-02-21T01:27:52.255Z',
        identities: [
          {
            name: '79684',
            dateVerified: '2018-02-21T00:52:40.149Z',
            provider: {id: 'github', name: 'GitHub'},
            dateSynced: '2018-02-21T00:52:40.149Z',
            organization: {slug: 'default', name: 'default'},
            id: '1',
          },
        ],
        id: '1',
        isActive: true,
        has2fa: true,
        name: 'billy vong',
        avatarUrl:
          'https://secure.gravatar.com/avatar/7b544e8eb9d08ed777be5aa82121155a?s=32&d=mm',
        dateJoined: '2018-01-10T00:19:59Z',
        options: {
          timezone: 'America/Los_Angeles',
          seenReleaseBroadcast: true,
          stacktraceOrder: -1,
          language: 'en',
          clock24Hours: false,
        },
        avatar: {
          avatarUuid: '483ed7478a2248d59211f538c2997e0b',
          avatarType: 'letter_avatar',
        },
        lastLogin: '2018-02-14T07:09:37.536Z',
        permissions: [],
        email: 'billy@sentry.io',
      },
      message:
        "This is an example JavaScript exception TypeError Object [object Object] has no method 'updateFrom' poll(../../sentry/scripts/views.js)",
      type: 'error',
      id: '1',
      metadata: {
        type: 'TypeError',
        value: "Object [object Object] has no method 'updateFrom'",
      },
    },
  ],

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

  User: params => ({
    id: '1',
    username: 'foo@example.com',
    email: 'foo@example.com',
    name: 'Foo Bar',
    isAuthenticated: true,
    options: {
      timezone: 'UTC',
    },
    hasPasswordAuth: true,
    flags: {
      newsletter_consent_prompt: false,
    },
    ...params,
  }),

  UserFeedback: () => ({
    id: '123',
    name: 'Lyn',
    email: 'lyn@sentry.io',
    comments: 'Something bad happened',
    issue: TestStubs.Group(),
  }),

  /**
   * Plugins
   */
  AsanaPlugin,
  AsanaCreate,
  AsanaAutocomplete,
  PhabricatorPlugin,
  PhabricatorCreate,
  PhabricatorAutocomplete,
  VstsPlugin,
  VstsCreate,
};

// this is very commonly used, so expose it globally
window.MockApiClient = require.requireMock('app/api').Client;

// default configuration
ConfigStore.loadInitialData({
  messages: [],
  user: TestStubs.User(),
});
