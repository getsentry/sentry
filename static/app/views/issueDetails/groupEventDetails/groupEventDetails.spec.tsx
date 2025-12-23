import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  waitFor,
  within,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {IssueCategory, IssueType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import GroupEventDetails from 'sentry/views/issueDetails/groupEventDetails/groupEventDetails';
import type {TraceFullDetailed} from 'sentry/views/performance/newTraceDetails/traceApi/types';

const TRACE_ID = '797cda4e24844bdc90e0efe741616047';

const makeDefaultMockData = (
  organization?: Organization,
  project?: Project,
  query?: Record<string, string | string[]>
): {
  event: Event;
  group: Group;
  initialRouterConfig: RouterConfig;
  organization: Organization;
  project: Project;
} => {
  const group = GroupFixture();
  const org = organization ?? OrganizationFixture();

  return {
    project: project ?? ProjectFixture(),
    organization: org,
    initialRouterConfig: {
      location: {
        pathname: `/organizations/${org.slug}/issues/${group.id}/`,
        query: query ?? {},
      },
      route: `/organizations/:orgId/issues/:groupId/`,
    },
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
        profile: {
          profiler_id: 'a0f6f14c42c36b13',
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
  } as Partial<TraceFullDetailed>;
};

const mockGroupApis = (
  organization: Organization,
  project: Project,
  group: Group,
  event: Event,
  replayId?: string,
  trace?: Partial<TraceFullDetailed>
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
    body: AutofixSetupFixture({
      integration: {
        ok: true,
        reason: null,
      },
      githubWriteIntegration: {
        ok: true,
        repos: [],
      },
    }),
  });
  MockApiClient.addMockResponse({
    url: `/issues/${group.id}/autofix/`,
    body: {
      steps: [],
    },
  });

  MockApiClient.addMockResponse({
    url: '/subscriptions/org-slug/',
    method: 'GET',
    body: {},
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/profiling/chunks/`,
    body: {
      chunk: {
        profiler_id: event.contexts?.profile?.profiler_id,
      },
    },
  });
};

describe('groupEventDetails', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('redirects on switching to an invalid environment selection for event', async () => {
    const props = makeDefaultMockData();
    const eventRouterConfig = {
      ...props.initialRouterConfig,
      location: {
        ...props.initialRouterConfig.location,
        pathname: `/organizations/${props.organization.slug}/issues/${props.group.id}/events/${props.event.id}/`,
      },
      route: `/organizations/:orgId/issues/:groupId/events/:eventId/`,
    };
    mockGroupApis(props.organization, props.project, props.group, props.event);

    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/${props.group.id}/events/${props.event.id}/`,
      body: props.event,
    });

    const {router} = render(<GroupEventDetails />, {
      organization: props.organization,
      initialRouterConfig: eventRouterConfig,
    });
    expect(await screen.findByTestId('group-event-details')).toBeInTheDocument();

    router.navigate(`${router.location.pathname}?environment=prod`);

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: `/organizations/${props.organization.slug}/issues/${props.group.id}/`,
          query: expect.objectContaining({
            environment: 'prod',
          }),
        })
      );
    });
  });

  it('does not redirect when switching to a valid environment selection for event', async () => {
    const props = makeDefaultMockData();
    mockGroupApis(props.organization, props.project, props.group, props.event);

    const {router} = render(<GroupEventDetails />, {
      organization: props.organization,
      initialRouterConfig: props.initialRouterConfig,
    });

    const initialPathname = router.location.pathname;
    router.navigate(`${initialPathname}?environment=`);

    expect(await screen.findByTestId('group-event-details')).toBeInTheDocument();

    // Should not redirect - pathname should remain the same
    expect(router.location).toEqual(
      expect.objectContaining({
        pathname: initialPathname,
        query: expect.objectContaining({
          environment: '',
        }),
      })
    );
  });

  it('displays error on event error', async () => {
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
      initialRouterConfig: props.initialRouterConfig,
    });

    expect(await screen.findByText(/couldn't track down an event/)).toBeInTheDocument();
  });

  it('renders the Span Evidence section for Performance Issues', async () => {
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
      organization: props.organization,
      initialRouterConfig: props.initialRouterConfig,
    });

    expect(
      await screen.findByRole('region', {name: 'Span Evidence'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Collapse Span Evidence Section'})
    ).toBeInTheDocument();
  });

  it('renders the Function Evidence section for Profile Issues', async () => {
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
      initialRouterConfig: props.initialRouterConfig,
    });

    expect(
      await screen.findByRole('region', {name: 'Function Evidence'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Collapse Function Evidence Section'})
    ).toBeInTheDocument();
  });

  it('renders event tags ui', async () => {
    const {organization, project, group, event, initialRouterConfig} =
      makeDefaultMockData();
    mockGroupApis(organization, project, group, event);
    render(<GroupEventDetails />, {
      organization,
      initialRouterConfig,
    });

    expect(await screen.findByRole('region', {name: 'tags'})).toBeInTheDocument();
    const highlights = screen.getByRole('region', {name: 'Highlights'});

    expect(within(highlights).getByRole('button', {name: 'Edit'})).toBeInTheDocument();
    // No highlights setup
    expect(
      within(highlights).getByRole('button', {name: 'Add Highlights'})
    ).toBeInTheDocument();
    expect(screen.getByText("There's nothing here...")).toBeInTheDocument();
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
        initialRouterConfig: props.initialRouterConfig,
      });

      expect(
        await screen.findByRole('region', {name: 'Suspect Root Cause'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Collapse Suspect Root Cause Section'})
      ).toBeInTheDocument();
      expect(screen.getByText('File IO on Main Thread')).toBeInTheDocument();
    });

    it('shows ANR profile section for Android ANR events', async () => {
      const project = ProjectFixture({platform: 'android'});
      const props = makeDefaultMockData(undefined, project);
      ProjectsStore.loadInitialData([props.project]);
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
        initialRouterConfig: props.initialRouterConfig,
      });

      expect(
        await screen.findByRole('region', {name: 'profile-preview'})
      ).toBeInTheDocument();
      expect(screen.getByText('ANR Profile')).toBeInTheDocument();
    });

    it('renders App Hang profile section for iOS ANR events', async () => {
      const project = ProjectFixture({platform: 'apple-ios'});
      const props = makeDefaultMockData(undefined, project);
      ProjectsStore.loadInitialData([props.project]);

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
        initialRouterConfig: props.initialRouterConfig,
      });

      expect(
        await screen.findByRole('region', {name: 'profile-preview'})
      ).toBeInTheDocument();
      expect(screen.getByText('App Hang Profile')).toBeInTheDocument();
    });

    it('does not render ANR profile section for js events', async () => {
      const project = ProjectFixture({platform: 'javascript-electron'});
      const props = makeDefaultMockData(undefined, project);
      ProjectsStore.loadInitialData([props.project]);

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
        initialRouterConfig: props.initialRouterConfig,
      });

      // Wait for component to render by checking for an element that should be present
      expect(await screen.findByTestId('group-event-details')).toBeInTheDocument();

      // Check that profile-preview does not exist
      expect(
        screen.queryByRole('region', {name: 'profile-preview'})
      ).not.toBeInTheDocument();
    });

    it('does not render root cause section if related perf issues do not exist', async () => {
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
        initialRouterConfig: props.initialRouterConfig,
      });

      // mechanism: ANR
      expect(await screen.findByText('ANR')).toBeInTheDocument();
      expect(
        screen.queryByRole('region', {name: 'Suspect Root Cause'})
      ).not.toBeInTheDocument();
      expect(screen.queryByText('File IO on Main Thread')).not.toBeInTheDocument();
    });
  });
});
