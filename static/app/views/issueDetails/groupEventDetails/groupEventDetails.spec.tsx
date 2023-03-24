import {browserHistory, InjectedRouter} from 'react-router';
import {Location} from 'history';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {EntryType, Event, Group, IssueCategory, IssueType} from 'sentry/types';
import {Organization} from 'sentry/types/organization';
import {Project} from 'sentry/types/project';
import GroupEventDetails, {
  GroupEventDetailsProps,
} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetails';
import {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

const TRACE_ID = '797cda4e24844bdc90e0efe741616047';

const makeDefaultMockData = (
  organization?: Organization,
  project?: Project
): {
  event: Event;
  group: Group;
  organization: Organization;
  project: Project;
  router: InjectedRouter;
} => {
  return {
    organization: organization ?? initializeOrg().organization,
    project: project ?? initializeOrg().project,
    group: TestStubs.Group(),
    router: TestStubs.router({}),
    event: TestStubs.Event({
      size: 1,
      dateCreated: '2019-03-20T00:00:00.000Z',
      errors: [],
      entries: [],
      tags: [{key: 'environment', value: 'dev'}],
      contexts: {
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

const TestComponent = (props: Partial<GroupEventDetailsProps>) => {
  const {organization, project, group, event, router} = makeDefaultMockData(
    props.organization,
    props.project
  );

  const mergedProps: GroupEventDetailsProps = {
    api: new MockApiClient(),
    group,
    event,
    project,
    organization,
    environments: [{id: '1', name: 'dev', displayName: 'Dev'}],
    params: {groupId: group.id, eventId: '1'},
    router,
    location: {} as Location<any>,
    route: {},
    eventError: props.eventError ?? false,
    groupReprocessingStatus:
      props.groupReprocessingStatus ?? ReprocessingStatus.NO_STATUS,
    onRetry: props?.onRetry ?? jest.fn(),
    loadingEvent: props.loadingEvent ?? false,
    routes: [],
    routeParams: {},
    ...props,
  };

  return <GroupEventDetails {...mergedProps} />;
};

const mockedTrace = (project: Project) => {
  return [
    {
      event_id: '8806ea4691c24fc7b1c77ecd78df574f',
      span_id: 'b0e6f15b45c36b12',
      transaction: 'MainActivity.add_attachment',
      'transaction.duration': 1000,
      'transaction.op': 'navigation',
      project_id: project.id,
      project_slug: project.slug,
      parent_span_id: null,
      parent_event_id: null,
      generation: 0,
      errors: [
        {
          event_id: 'c6971a73454646338bc3ec80c70f8891',
          issue_id: 104,
          span: 'b0e6f15b45c36b12',
          project_id: project.id,
          project_slug: project.slug,
          title: 'ApplicationNotResponding: ANR for at least 5000 ms.',
          level: 'error',
        },
      ],
      performance_issues: [
        {
          event_id: '8806ea4691c24fc7b1c77ecd78df574f',
          issue_id: 110,
          issue_short_id: 'SENTRY-ANDROID-1R',
          span: ['b0e6f15b45c36b12'],
          suspect_spans: ['89930aab9a0314d4'],
          project_id: project.id,
          project_slug: project.slug,
          title: 'File IO on Main Thread',
          level: 'info',
          culprit: 'MainActivity.add_attachment',
        },
      ],
      timestamp: 1678290375.150561,
      start_timestamp: 1678290374.150561,
      children: [],
    },
  ];
};

const mockGroupApis = (
  organization: Organization,
  project: Project,
  group: Group,
  event: Event
) => {
  MockApiClient.addMockResponse({
    url: `/issues/${group.id}/`,
    body: group,
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
    url: `/projects/${organization.slug}/${project.slug}/releases/completion/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/owners/`,
    body: {owners: [], rules: []},
  });

  MockApiClient.addMockResponse({
    url: `/issues/${group.id}/tags/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events-trace/${TRACE_ID}/`,
    body: mockedTrace(project),
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events-trace-light/${TRACE_ID}/`,
    body: mockedTrace(project),
  });

  MockApiClient.addMockResponse({
    url: `/groups/${group.id}/integrations/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/groups/${group.id}/external-issues/`,
  });

  MockApiClient.addMockResponse({
    url: `/issues/${group.id}/current-release/`,
    body: {currentRelease: null},
  });

  MockApiClient.addMockResponse({
    url: '/prompts-activity/',
    body: undefined,
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
    url: `/organizations/${organization.slug}/sentry-app-components/?projectId=${project.id}`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: '/projects/org-slug/project-slug/',
    body: project,
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/users/',
    body: [],
  });
};

describe('groupEventDetails', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    (browserHistory.replace as jest.Mock).mockClear();
  });

  it('redirects on switching to an invalid environment selection for event', async function () {
    const props = makeDefaultMockData();
    mockGroupApis(props.organization, props.project, props.group, props.event);

    const {rerender} = render(<TestComponent {...props} />, {
      organization: props.organization,
    });
    expect(browserHistory.replace).not.toHaveBeenCalled();

    rerender(
      <TestComponent environments={[{id: '1', name: 'prod', displayName: 'Prod'}]} />
    );

    await waitFor(() => expect(browserHistory.replace).toHaveBeenCalled());
  });

  it('does not redirect when switching to a valid environment selection for event', async function () {
    const props = makeDefaultMockData();
    mockGroupApis(props.organization, props.project, props.group, props.event);

    const {rerender} = render(<TestComponent {...props} />, {
      organization: props.organization,
    });

    expect(browserHistory.replace).not.toHaveBeenCalled();
    rerender(<TestComponent environments={[]} />);

    expect(await screen.findByTestId('group-event-details')).toBeInTheDocument();

    expect(browserHistory.replace).not.toHaveBeenCalled();
  });

  it('displays error on event error', async function () {
    const props = makeDefaultMockData();

    mockGroupApis(
      props.organization,
      props.project,
      props.group,
      TestStubs.Event({
        size: 1,
        dateCreated: '2019-03-20T00:00:00.000Z',
        errors: [],
        entries: [],
        tags: [{key: 'environment', value: 'dev'}],
        previousEventID: 'prev-event-id',
        nextEventID: 'next-event-id',
      })
    );

    render(<TestComponent event={undefined} eventError />, {
      organization: props.organization,
    });

    expect(
      await screen.findByText(/events for this issue could not be found/)
    ).toBeInTheDocument();
  });

  it('renders the Span Evidence and Resources section for Performance Issues', async function () {
    const props = makeDefaultMockData();
    const group: Group = TestStubs.Group({
      issueCategory: IssueCategory.PERFORMANCE,
      issueType: IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
    });
    const transaction = TestStubs.Event({
      entries: [{type: EntryType.SPANS, data: []}],
    });

    mockGroupApis(
      props.organization,
      props.project,
      props.group,
      TestStubs.Event({
        size: 1,
        dateCreated: '2019-03-20T00:00:00.000Z',
        errors: [],
        entries: [],
        tags: [{key: 'environment', value: 'dev'}],
        previousEventID: 'prev-event-id',
        nextEventID: 'next-event-id',
      })
    );

    const routerContext = TestStubs.routerContext();
    await act(async () => {
      render(<TestComponent group={group} event={transaction} />, {
        organization: props.organization,
        context: routerContext,
      });
      await tick();
    });

    expect(
      screen.getByRole('heading', {
        name: /span evidence/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /resources/i,
      })
    ).toBeInTheDocument();
  });

  it('renders the Function Evidence and Resources section for Profile Issues', async function () {
    const props = makeDefaultMockData();
    const group: Group = TestStubs.Group({
      issueCategory: IssueCategory.PROFILE,
      issueType: IssueType.PROFILE_FILE_IO_MAIN_THREAD,
    });
    const transaction = TestStubs.Event({
      entries: [],
      occurrence: {
        evidenceDisplay: [],
        evidenceData: {},
        type: 2000,
      },
    });

    mockGroupApis(
      props.organization,
      props.project,
      props.group,
      TestStubs.Event({
        size: 1,
        dateCreated: '2019-03-20T00:00:00.000Z',
        errors: [],
        entries: [],
        tags: [{key: 'environment', value: 'dev'}],
        previousEventID: 'prev-event-id',
        nextEventID: 'next-event-id',
      })
    );

    const routerContext = TestStubs.routerContext();
    await act(async () => {
      render(<TestComponent group={group} event={transaction} />, {
        organization: props.organization,
        context: routerContext,
      });
      await tick();
    });

    expect(
      screen.getByRole('heading', {
        name: /function evidence/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /resources/i,
      })
    ).toBeInTheDocument();
  });
});

describe('EventCause', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    (browserHistory.replace as jest.Mock).mockClear();
  });

  it('renders suspect commit', async function () {
    const props = makeDefaultMockData(
      undefined,
      TestStubs.Project({firstEvent: TestStubs.Event()})
    );

    mockGroupApis(
      props.organization,
      props.project,
      props.group,
      TestStubs.Event({
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
      url: `/projects/${props.organization.slug}/${props.project.slug}/releases/completion/`,
      body: [
        {
          step: 'commit',
          complete: true,
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${props.organization.slug}/${props.project.slug}/events/${props.event.id}/committers/`,
      body: {
        committers: [
          {
            commits: [TestStubs.Commit({author: TestStubs.CommitAuthor()})],
            author: TestStubs.CommitAuthor(),
          },
        ],
      },
    });

    render(<TestComponent project={props.project} />, {organization: props.organization});

    expect(await screen.findByTestId(/event-cause/)).toBeInTheDocument();
    expect(screen.queryByTestId(/loaded-event-cause-empty/)).not.toBeInTheDocument();
  });

  it('renders suspect commit if `releasesCompletion` empty', async function () {
    const props = makeDefaultMockData(
      undefined,
      TestStubs.Project({firstEvent: TestStubs.Event()})
    );

    mockGroupApis(
      props.organization,
      props.project,
      props.group,
      TestStubs.Event({
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
      url: `/projects/${props.organization.slug}/${props.project.slug}/releases/completion/`,
      body: [],
    });

    await act(async () => {
      render(<TestComponent project={props.project} />, {
        organization: props.organization,
      });
      await tick();
    });

    expect(screen.queryByTestId(/loaded-event-cause-empty/)).not.toBeInTheDocument();
  });
});

describe('Platform Integrations', () => {
  let componentsRequest;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('loads Integration UI components', async () => {
    const props = makeDefaultMockData();

    const unpublishedIntegration = TestStubs.SentryApp({status: 'unpublished'});
    const internalIntegration = TestStubs.SentryApp({status: 'internal'});

    const unpublishedInstall = TestStubs.SentryAppInstallation({
      app: {
        slug: unpublishedIntegration.slug,
        uuid: unpublishedIntegration.uuid,
      },
    });

    const internalInstall = TestStubs.SentryAppInstallation({
      app: {
        slug: internalIntegration.slug,
        uuid: internalIntegration.uuid,
      },
    });

    mockGroupApis(
      props.organization,
      props.project,
      props.group,
      TestStubs.Event({
        size: 1,
        dateCreated: '2019-03-20T00:00:00.000Z',
        errors: [],
        entries: [],
        tags: [{key: 'environment', value: 'dev'}],
        previousEventID: 'prev-event-id',
        nextEventID: 'next-event-id',
      })
    );

    const component = TestStubs.SentryAppComponent({
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
      url: `/organizations/${props.organization.slug}/sentry-app-components/?projectId=${props.project.id}`,
      body: [component],
    });

    await act(async () => {
      render(<TestComponent />, {organization: props.organization});
      await tick();
    });

    expect(componentsRequest).toHaveBeenCalled();
  });
});
