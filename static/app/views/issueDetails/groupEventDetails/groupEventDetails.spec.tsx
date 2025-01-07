import {CommitFixture} from 'sentry-fixture/commit';
import {CommitAuthorFixture} from 'sentry-fixture/commitAuthor';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';
import {SentryAppComponentFixture} from 'sentry-fixture/sentryAppComponent';
import {SentryAppInstallationFixture} from 'sentry-fixture/sentryAppInstallation';

import {render, screen, waitFor, within} from 'sentry-test/reactTestingLibrary';

import type {Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {IssueCategory, IssueType} from 'sentry/types/group';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {QuickTraceEvent} from 'sentry/utils/performance/quickTrace/types';
import GroupEventDetails from 'sentry/views/issueDetails/groupEventDetails/groupEventDetails';

const TRACE_ID = '797cda4e24844bdc90e0efe741616047';

const makeDefaultMockData = (
  organization?: Organization,
  project?: Project,
  query?: Record<string, string | string[]>
): {
  event: Event;
  group: Group;
  organization: Organization;
  project: Project;
  router: InjectedRouter;
} => {
  const group = GroupFixture();
  const org = organization ?? OrganizationFixture();

  return {
    project: project ?? ProjectFixture(),
    organization: org,
    router: RouterFixture({
      params: {orgId: org.slug, groupId: group.id},
      location: LocationFixture({
        query: query ?? {},
      }),
    }),
    group,
    event: EventFixture({
      size: 1,
      dateCreated: '2019-03-20T00:00:00.000Z',
      errors: [],
      entries: [],
      tags: [
        {key: 'environment', value: 'dev'},
        {key: 'mechanism', value: 'ANR'},
      ],
      contexts: {
        app: {
          app_start_time: '2021-08-31T15:14:21Z',
          device_app_hash: '0b77c3f2567d65fe816e1fa7013779fbe3b51633',
          build_type: 'test',
          app_identifier: 'io.sentry.sample.iOS-Swift',
          app_name: 'iOS-Swift',
          app_version: '7.2.3',
          app_build: '390',
          app_id: 'B2690307-FDD1-3D34-AA1E-E280A9C2406C',
          type: 'app',
        },
        device: {
          family: 'iOS',
          model: 'iPhone13,4',
          model_id: 'D54pAP',
          memory_size: 5987008512,
          free_memory: 154435584,
          usable_memory: 4706893824,
          storage_size: 127881465856,
          boot_time: '2021-08-29T06:05:51Z',
          timezone: 'CEST',
          type: 'device',
        },
        os: {
          name: 'iOS',
          version: '14.7.1',
          build: '18G82',
          kernel_version:
            'Darwin Kernel Version 20.6.0: Mon Jun 21 21:23:35 PDT 2021; root:xnu-7195.140.42~10/RELEASE_ARM64_T8101',
          rooted: false,
          type: 'os',
        },
        trace: {
          trace_id: TRACE_ID,
          span_id: 'b0e6f15b45c36b12',
          op: 'ui.action.click',
          type: 'trace',
        },
      },
    }),
  };
};

const mockedTrace = (project: Project) => {
  return {
    event_id: '8806ea4691c24fc7b1c77ecd78df574f',
    span_id: 'b0e6f15b45c36b12',
    transaction: 'MainActivity.add_attachment',
    'transaction.duration': 1000,
    'transaction.op': 'navigation',
    project_id: parseInt(project.id, 10),
    project_slug: project.slug,
    parent_span_id: null,
    parent_event_id: null,
    generation: 0,
    errors: [
      {
        event_id: 'c6971a73454646338bc3ec80c70f8891',
        issue_id: 104,
        span: 'b0e6f15b45c36b12',
        project_id: parseInt(project.id, 10),
        project_slug: project.slug,
        title: 'ApplicationNotResponding: ANR for at least 5000 ms.',
        message: 'ANR for at least 5000 ms.',
        level: 'error',
        issue: '',
      },
    ],
    performance_issues: [
      {
        event_id: '8806ea4691c24fc7b1c77ecd78df574f',
        issue_id: 110,
        issue_short_id: 'SENTRY-ANDROID-1R',
        span: ['b0e6f15b45c36b12'],
        suspect_spans: ['89930aab9a0314d4'],
        project_id: parseInt(project.id, 10),
        project_slug: project.slug,
        title: 'File IO on Main Thread',
        message: 'File IO on Main Thread',
        level: 'info',
        culprit: 'MainActivity.add_attachment',
        type: 1008,
        end: 1678290375.15056,
        start: 1678290374.150562,
      },
    ],
    timestamp: 1678290375.150561,
    start_timestamp: 1678290374.150561,
    children: [],
  } as QuickTraceEvent;
};

const mockGroupApis = (
  organization: Organization,
  project: Project,
  group: Group,
  event: Event,
  replayId?: string,
  trace?: QuickTraceEvent
) => {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/issues/1/events/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/flags/logs/',
    body: {data: []},
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${group.id}/`,
    body: group,
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
    body: event,
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/replays/${replayId}/`,
    body: {},
  });

  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/issues/`,
    method: 'PUT',
  });

  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
    body: {committers: []},
  });

  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/owners/`,
    body: {owners: [], rules: []},
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events-trace/${TRACE_ID}/`,
    body: trace
      ? {transactions: [trace], orphan_errors: []}
      : {transactions: [], orphan_errors: []},
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events-trace-light/${TRACE_ID}/`,
    body: trace
      ? {transactions: [trace], orphan_errors: []}
      : {transactions: [], orphan_errors: []},
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${group.id}/external-issues/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${group.id}/current-release/`,
    body: {currentRelease: null},
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/prompts-activity/`,
    body: {data: {}, features: {['issue_feedback_hidden']: {}}},
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/prompts-activity/`,
    method: 'PUT',
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/has-mobile-app-events/`,
    body: null,
  });

  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/grouping-info/`,
    body: {},
  });
  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/codeowners/`,
    body: [],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/code-mappings/`,
    method: 'GET',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/actionable-items/`,
    body: {
      errors: [],
    },
  });

  // Sentry related mocks
  MockApiClient.addMockResponse({
    url: '/sentry-apps/',
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/sentry-apps/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/sentry-app-installations/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/sentry-app-components/`,
    body: [],
    match: [MockApiClient.matchQuery({projectId: project.id})],
  });

  MockApiClient.addMockResponse({
    url: '/projects/org-slug/project-slug/',
    body: project,
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/users/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/projects/',
    body: [project],
  });

  MockApiClient.addMockResponse({
    url: `/customers/org-slug/policies/`,
    body: {},
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
    method: 'GET',
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    body: {
      data: [],
      meta: {fields: {}, units: {}},
    },
  });
  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/`,
    body: project,
  });

  MockApiClient.addMockResponse({
    url: `/issues/${group.id}/autofix/setup/`,
    method: 'GET',
    body: {
      integration: {
        ok: true,
      },
      genAIConsent: {
        ok: true,
      },
      githubWriteIntegration: {
        ok: true,
      },
    },
  });
};

describe('groupEventDetails', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('redirects on switching to an invalid environment selection for event', async function () {
    const props = makeDefaultMockData();
    props.router.params.eventId = props.event.id;
    mockGroupApis(props.organization, props.project, props.group, props.event);

    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/${props.group.id}/events/${props.event.id}/`,
      body: props.event,
    });

    const {rerender} = render(<GroupEventDetails />, {
      organization: props.organization,
      router: props.router,
    });
    expect(await screen.findByTestId('group-event-details')).toBeInTheDocument();
    expect(props.router.replace).not.toHaveBeenCalled();

    props.router.location.query.environment = ['prod'];
    rerender(<GroupEventDetails />);

    await waitFor(() => expect(props.router.replace).toHaveBeenCalled());
  });

  it('does not redirect when switching to a valid environment selection for event', async function () {
    const props = makeDefaultMockData();
    mockGroupApis(props.organization, props.project, props.group, props.event);

    const {rerender} = render(<GroupEventDetails />, {
      organization: props.organization,
      router: props.router,
    });

    expect(props.router.replace).not.toHaveBeenCalled();
    props.router.location.query.environment = [];
    rerender(<GroupEventDetails />);

    expect(await screen.findByTestId('group-event-details')).toBeInTheDocument();

    expect(props.router.replace).not.toHaveBeenCalled();
  });

  it('displays error on event error', async function () {
    const props = makeDefaultMockData();

    mockGroupApis(
      props.organization,
      props.project,
      props.group,
      EventFixture({
        size: 1,
        dateCreated: '2019-03-20T00:00:00.000Z',
        errors: [],
        entries: [],
        tags: [{key: 'environment', value: 'dev'}],
        previousEventID: 'prev-event-id',
        nextEventID: 'next-event-id',
      })
    );

    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/${props.group.id}/events/recommended/`,
      statusCode: 500,
    });

    render(<GroupEventDetails />, {
      organization: props.organization,
      router: props.router,
    });

    expect(
      await screen.findByText(/events for this issue could not be found/)
    ).toBeInTheDocument();
  });

  it('renders the Span Evidence section for Performance Issues', async function () {
    const props = makeDefaultMockData();
    const group: Group = GroupFixture({
      issueCategory: IssueCategory.PERFORMANCE,
      issueType: IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
    });
    const transactionEvent = EventFixture({
      entries: [{type: EntryType.SPANS, data: []}],
    });

    mockGroupApis(props.organization, props.project, group, transactionEvent);

    render(<GroupEventDetails />, {
      router: props.router,
      organization: props.organization,
    });

    expect(
      await screen.findByRole('heading', {
        name: /span evidence/i,
      })
    ).toBeInTheDocument();
  });

  it('renders the Function Evidence section for Profile Issues', async function () {
    const props = makeDefaultMockData();
    const group: Group = GroupFixture({
      issueCategory: IssueCategory.PERFORMANCE,
      issueType: IssueType.PROFILE_FILE_IO_MAIN_THREAD,
    });
    const transactionEvent = EventFixture({
      entries: [],
      occurrence: {
        evidenceDisplay: [],
        evidenceData: {
          templateName: 'profile',
        },
        type: 2001,
      },
    });

    mockGroupApis(props.organization, props.project, group, transactionEvent);

    render(<GroupEventDetails />, {
      organization: props.organization,
      router: props.router,
    });

    expect(
      await screen.findByRole('heading', {
        name: /function evidence/i,
      })
    ).toBeInTheDocument();
  });

  it('renders event tags ui', async () => {
    const props = makeDefaultMockData();
    mockGroupApis(props.organization, props.project, props.group, props.event);
    render(<GroupEventDetails />, {
      organization: props.organization,
      router: props.router,
    });

    expect(await screen.findByText('Event ID:')).toBeInTheDocument();
    expect(screen.queryByTestId('context-summary')).not.toBeInTheDocument();
    expect(screen.getByTestId('event-tags')).toBeInTheDocument();
    const highlights = screen.getByTestId('event-highlights');
    expect(
      within(highlights).getByRole('button', {name: 'View All'})
    ).toBeInTheDocument();
    expect(within(highlights).getByRole('button', {name: 'Edit'})).toBeInTheDocument();
    // No highlights setup
    expect(
      within(highlights).getByRole('button', {name: 'Add Highlights'})
    ).toBeInTheDocument();
    expect(screen.getByText("There's nothing here...")).toBeInTheDocument();
  });
});

describe('EventCause', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders suspect commit', async function () {
    const props = makeDefaultMockData(
      undefined,
      ProjectFixture({firstEvent: EventFixture().dateCreated})
    );

    mockGroupApis(
      props.organization,
      props.project,
      props.group,
      EventFixture({
        size: 1,
        dateCreated: '2019-03-20T00:00:00.000Z',
        errors: [],
        entries: [],
        tags: [{key: 'environment', value: 'dev'}],
        previousEventID: 'prev-event-id',
        nextEventID: 'next-event-id',
      })
    );

    MockApiClient.addMockResponse({
      url: `/projects/${props.organization.slug}/${props.project.slug}/events/${props.event.id}/committers/`,
      body: {
        committers: [
          {
            commits: [CommitFixture({author: CommitAuthorFixture()})],
            author: CommitAuthorFixture(),
          },
        ],
      },
    });

    render(<GroupEventDetails />, {
      organization: props.organization,
      router: props.router,
    });

    expect(await screen.findByTestId(/suspect-commit/)).toBeInTheDocument();
  });
});

describe('Platform Integrations', () => {
  let componentsRequest: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('loads Integration UI components', async () => {
    const props = makeDefaultMockData();

    const unpublishedIntegration = SentryAppFixture({status: 'unpublished'});
    const internalIntegration = SentryAppFixture({status: 'internal'});

    const unpublishedInstall = SentryAppInstallationFixture({
      app: {
        slug: unpublishedIntegration.slug,
        uuid: unpublishedIntegration.uuid,
      },
    });

    const internalInstall = SentryAppInstallationFixture({
      app: {
        slug: internalIntegration.slug,
        uuid: internalIntegration.uuid,
      },
    });

    mockGroupApis(
      props.organization,
      props.project,
      props.group,
      EventFixture({
        size: 1,
        dateCreated: '2019-03-20T00:00:00.000Z',
        errors: [],
        entries: [],
        tags: [{key: 'environment', value: 'dev'}],
        previousEventID: 'prev-event-id',
        nextEventID: 'next-event-id',
      })
    );

    const component = SentryAppComponentFixture({
      sentryApp: {
        uuid: unpublishedIntegration.uuid,
        slug: unpublishedIntegration.slug,
        name: unpublishedIntegration.name,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/sentry-app-installations/`,
      body: [unpublishedInstall, internalInstall],
    });

    componentsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/sentry-app-components/`,
      body: [component],
      match: [MockApiClient.matchQuery({projectId: props.project.id})],
    });

    render(<GroupEventDetails />, {
      organization: props.organization,
      router: props.router,
    });

    expect(await screen.findByText('Sample App Issue')).toBeInTheDocument();
    expect(componentsRequest).toHaveBeenCalled();
  });

  describe('ANR Root Cause', () => {
    beforeEach(() => {
      MockApiClient.clearMockResponses();
    });
    it('shows anr root cause', async () => {
      const props = makeDefaultMockData();
      mockGroupApis(
        props.organization,
        props.project,
        props.group,
        props.event,
        undefined,
        mockedTrace(props.project)
      );

      render(<GroupEventDetails />, {
        organization: props.organization,
        router: props.router,
      });

      expect(
        await screen.findByRole('heading', {
          name: /suspect root cause/i,
        })
      ).toBeInTheDocument();
      expect(screen.getByText('File IO on Main Thread')).toBeInTheDocument();
    });

    it('does not render root issues section if related perf issues do not exist', async () => {
      const props = makeDefaultMockData();
      const trace = mockedTrace(props.project);
      mockGroupApis(
        props.organization,
        props.project,
        props.group,
        props.event,
        undefined,
        {
          ...trace,
          performance_issues: [],
        }
      );

      render(<GroupEventDetails />, {
        organization: props.organization,
        router: props.router,
      });

      // mechanism: ANR
      expect(await screen.findByText('ANR')).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', {
          name: /suspect root issues/i,
        })
      ).not.toBeInTheDocument();
      expect(screen.queryByText('File IO on Main Thread')).not.toBeInTheDocument();
    });
  });
});
