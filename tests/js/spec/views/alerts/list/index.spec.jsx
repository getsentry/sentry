import selectEvent from 'react-select-event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import AlertsContainer from 'sentry/views/alerts';
import IncidentsList from 'sentry/views/alerts/list/incidents';

describe('IncidentsList', () => {
  let projectMock;
  const projects1 = ['a', 'b', 'c'];
  const projects2 = ['c', 'd'];

  const renderComponent = ({organization} = {}) => {
    const context = initializeOrg({
      organization: {
        features: ['incidents'],
        ...organization,
      },
    });
    const routerContext = context.routerContext;
    const org = context.organization;
    const router = context.router;
    return {
      component: render(
        <AlertsContainer>
          <IncidentsList
            params={{orgId: org.slug}}
            location={{query: {}, search: ''}}
            router={router}
          />
        </AlertsContainer>,
        {context: routerContext, organization: org}
      ),
      router,
    };
  };

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/',
      body: [
        TestStubs.Incident({
          id: '123',
          identifier: '1',
          title: 'First incident',
          projects: projects1,
        }),
        TestStubs.Incident({
          id: '342',
          identifier: '2',
          title: 'Second incident',
          projects: projects2,
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/2/stats/',
      body: TestStubs.IncidentStats({
        totalEvents: 1000,
        uniqueUsers: 32,
        eventStats: {
          data: [[1591390293327, [{count: 42}]]],
        },
      }),
    });

    const projects = [
      TestStubs.Project({slug: 'a', platform: 'javascript'}),
      TestStubs.Project({slug: 'b'}),
      TestStubs.Project({slug: 'c'}),
      TestStubs.Project({slug: 'd'}),
    ];

    projectMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: projects,
    });
    act(() => ProjectsStore.loadInitialData(projects));
  });

  afterEach(() => {
    act(() => ProjectsStore.reset());
    MockApiClient.clearMockResponses();
  });

  it('displays list', async () => {
    renderComponent();

    const items = await screen.findAllByTestId('alert-title');

    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('First incident')).toBeInTheDocument();
    expect(within(items[1]).getByText('Second incident')).toBeInTheDocument();

    expect(projectMock).toHaveBeenCalledTimes(1);

    expect(projectMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({query: 'slug:a slug:b slug:c'}),
      })
    );

    const projectBadges = screen.getAllByTestId('badge-display-name');
    expect(within(projectBadges[0]).getByText('a')).toBeInTheDocument();
  });

  it('displays empty state (first time experience)', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/',
      body: [],
    });
    const rulesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rules/',
      body: [],
    });
    const promptsMock = MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {data: {dismissed_ts: null}},
    });
    const promptsUpdateMock = MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      method: 'PUT',
    });

    renderComponent();

    expect(await screen.findByText('More signal, less noise')).toBeInTheDocument();

    expect(rulesMock).toHaveBeenCalledTimes(1);
    expect(promptsMock).toHaveBeenCalledTimes(1);
    expect(promptsUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('displays empty state (rules not yet created)', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/',
      body: [],
    });
    const rulesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rules/',
      body: [],
    });
    const promptsMock = MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {data: {dismissed_ts: Math.floor(Date.now() / 1000)}},
    });

    renderComponent();

    expect(
      await screen.findByText('No incidents exist for the current query.')
    ).toBeInTheDocument();

    expect(rulesMock).toHaveBeenCalledTimes(1);
    expect(promptsMock).toHaveBeenCalledTimes(1);
  });

  it('displays empty state (rules created)', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/',
      body: [],
    });
    const rulesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rules/',
      body: [{id: 1}],
    });
    const promptsMock = MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {data: {dismissed_ts: Math.floor(Date.now() / 1000)}},
    });

    renderComponent();

    expect(
      await screen.findByText('No incidents exist for the current query.')
    ).toBeInTheDocument();

    expect(rulesMock).toHaveBeenCalledTimes(1);
    expect(promptsMock).toHaveBeenCalledTimes(0);
  });

  it('filters by status', async () => {
    const {router} = renderComponent();

    await selectEvent.select(await screen.findByText('Status'), 'Active');

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          status: 'open',
        },
      })
    );
  });

  it('disables the new alert button for those without alert:write', async () => {
    const noAccessOrg = {
      access: [],
    };

    renderComponent({organization: noAccessOrg});
    expect(await screen.findByLabelText('Create Alert')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('does not disable the new alert button for those with alert:write', async () => {
    // Enabled with access
    renderComponent();

    expect(await screen.findByLabelText('Create Alert')).toHaveAttribute(
      'aria-disabled',
      'false'
    );
  });

  it('searches by name', async () => {
    const {router} = renderComponent();

    const input = await screen.findByPlaceholderText('Search by name');
    expect(input).toBeInTheDocument();
    const testQuery = 'test name';
    userEvent.type(input, `${testQuery}{enter}`);

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          title: testQuery,
        },
      })
    );
  });

  it('displays owner from alert rule', async () => {
    const team = TestStubs.Team();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/',
      body: [
        TestStubs.Incident({
          id: '123',
          identifier: '1',
          title: 'First incident',
          projects: projects1,
          alertRule: TestStubs.MetricRule({owner: `team:${team.id}`}),
        }),
      ],
    });
    TeamStore.getById = jest.fn().mockReturnValue(team);

    renderComponent();
    expect(await screen.findByText(team.name)).toBeInTheDocument();
  });
});
