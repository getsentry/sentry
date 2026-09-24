import {
  ActionFilterFixture,
  ActionFixture,
  AutomationFixture,
} from 'sentry-fixture/automations';
import {
  AllProjectsDetectorFixture,
  IssueStreamDetectorFixture,
  MetricDetectorFixture,
} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {ActionTarget} from 'sentry/types/workflowEngine/actions';
import AutomationDetail from 'sentry/views/automations/detail';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';

describe('AutomationDetail', () => {
  const organization = OrganizationFixture();
  const automation = AutomationFixture({
    id: '123',
    name: 'Test Automation',
    detectorIds: ['1', '2'],
  });
  const user = UserFixture({
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
  });
  const detectors = [
    MetricDetectorFixture({
      id: '1',
      name: 'CPU Usage Monitor',
      projectId: '1',
    }),
    MetricDetectorFixture({
      id: '2',
      name: 'Memory Usage Monitor',
      projectId: '2',
    }),
  ];

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {period: '14d', start: null, end: null, utc: null},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/1/',
      body: user,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/',
      body: automation,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: detectors,
      match: [MockApiClient.matchQuery({query: '!type:issue_stream workflow:123'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [],
      match: [MockApiClient.matchQuery({query: 'type:issue_stream workflow:123'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/stats/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/group-history/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/available-actions/`,
      method: 'GET',
      body: [],
    });
  });

  it('displays automation details correctly', async () => {
    render(<AutomationDetail />, {
      organization,
      initialRouterConfig: {
        route: '/alerts/:automationId/',
        location: {pathname: '/alerts/123/'},
      },
    });

    expect(
      await screen.findByRole('heading', {name: /Test Automation/i})
    ).toBeInTheDocument();

    // Check sidebar sections
    expect(screen.getByRole('heading', {name: 'Last Triggered'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Environment'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Throttling'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Conditions'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Details'})).toBeInTheDocument();
  });

  describe('breadcrumbs', () => {
    it('renders the parent crumb in the trail and the alert name as the page title', async () => {
      render(<AutomationDetail />, {
        organization,
        initialRouterConfig: {
          route: '/alerts/:automationId/',
          location: {pathname: '/alerts/123/'},
        },
      });

      const alertsCrumb = await screen.findByRole('link', {name: 'Alerts'});
      expect(alertsCrumb).toHaveAttribute(
        'href',
        `/organizations/${organization.slug}/monitors/alerts/`
      );

      expect(
        screen.getByRole('heading', {name: automation.name, level: 1})
      ).toBeInTheDocument();

      const trail = alertsCrumb.closest('ol')!;
      expect(within(trail).queryByText(automation.name)).not.toBeInTheDocument();
    });
  });

  it('shows all projects for an all-projects detector', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [AllProjectsDetectorFixture({id: '10'})],
      match: [MockApiClient.matchQuery({query: 'type:issue_stream workflow:123'})],
    });

    render(<AutomationDetail />, {
      organization,
      initialRouterConfig: {
        route: '/alerts/:automationId/',
        location: {pathname: '/alerts/123/'},
      },
    });

    expect(await screen.findByText('All Projects')).toBeInTheDocument();
  });

  it('can disable an enabled automation', async () => {
    const disabledAutomation = AutomationFixture({
      ...automation,
      enabled: false,
    });

    const updateRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/',
      method: 'PUT',
      body: {...disabledAutomation, enabled: false},
    });

    render(<AutomationDetail />, {
      organization,
      initialRouterConfig: {
        route: '/alerts/:automationId/',
        location: {pathname: '/alerts/123/'},
      },
    });

    const enableButton = await screen.findByRole('button', {name: 'Disable'});
    await userEvent.click(enableButton);

    await waitFor(() => {
      expect(updateRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/workflows/123/',
        expect.objectContaining({
          data: {
            id: '123',
            name: 'Test Automation',
            enabled: false,
          },
        })
      );
    });

    expect(screen.getAllByText('Enable')).toHaveLength(2);
  });

  describe('Action warnings', () => {
    it('displays warning when alert has no actions', async () => {
      const automationWithWarning = AutomationFixture({
        ...automation,
        actionFilters: [ActionFilterFixture({actions: []})],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/123/',
        body: automationWithWarning,
      });

      render(<AutomationDetail />, {
        organization,
        initialRouterConfig: {
          route: '/alerts/:automationId/',
          location: {pathname: '/alerts/123/'},
        },
      });

      await screen.findByRole('heading', {name: /Test Automation/i});

      expect(
        screen.getByText('You must add an action for this alert to run.')
      ).toBeInTheDocument();
    });

    it('displays warning all actions are invalid', async () => {
      const automationWithWarning = AutomationFixture({
        ...automation,
        actionFilters: [
          ActionFilterFixture({
            actions: [ActionFixture({status: 'disabled'})],
          }),
        ],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/123/',
        body: automationWithWarning,
      });

      render(<AutomationDetail />, {
        organization,
        initialRouterConfig: {
          route: '/alerts/:automationId/',
          location: {pathname: '/alerts/123/'},
        },
      });

      await screen.findByRole('heading', {name: /Test Automation/i});

      expect(
        screen.getByText(
          'Alert is invalid because no actions can run. Actions need to be reconfigured.'
        )
      ).toBeInTheDocument();
    });

    it('displays warning some actions are invalid', async () => {
      const automationWithWarning = AutomationFixture({
        ...automation,
        actionFilters: [
          ActionFilterFixture({
            actions: [ActionFixture(), ActionFixture({status: 'disabled'})],
          }),
        ],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/123/',
        body: automationWithWarning,
      });

      render(<AutomationDetail />, {
        organization,
        initialRouterConfig: {
          route: '/alerts/:automationId/',
          location: {pathname: '/alerts/123/'},
        },
      });

      await screen.findByRole('heading', {name: /Test Automation/i});

      expect(
        screen.getByText('One or more actions need to be reconfigured in order to run.')
      ).toBeInTheDocument();
    });
  });

  it('displays no connections warning when detectorIds is empty', async () => {
    const automationWithNoConnections = AutomationFixture({
      ...automation,
      detectorIds: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/',
      body: automationWithNoConnections,
    });

    render(<AutomationDetail />, {
      organization,
      initialRouterConfig: {
        route: '/alerts/:automationId/',
        location: {pathname: '/alerts/123/'},
      },
    });

    await screen.findByRole('heading', {name: /Test Automation/i});

    expect(
      screen.getByText(
        'This alert is not connected to a project or monitor and will not trigger.'
      )
    ).toBeInTheDocument();
  });

  it('does not display no connections warning when detectorIds exist', async () => {
    render(<AutomationDetail />, {
      organization,
      initialRouterConfig: {
        route: '/alerts/:automationId/',
        location: {pathname: '/alerts/123/'},
      },
    });

    await screen.findByRole('heading', {name: /Test Automation/i});

    expect(
      screen.queryByText(
        'This alert is not connected to a project or monitor and will not trigger.'
      )
    ).not.toBeInTheDocument();
  });

  it('disables action buttons without alerts:write permission', async () => {
    const noWriteOrg = OrganizationFixture({
      access: ['org:read', 'alerts:read'],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/project-scope/',
      body: {projectIds: ['10'], includesAllProjects: false},
    });

    render(<AutomationDetail />, {
      organization: noWriteOrg,
      initialRouterConfig: {
        route: '/alerts/:automationId/',
        location: {pathname: '/alerts/123/'},
      },
    });

    await screen.findByRole('heading', {name: /Test Automation/i});

    expect(screen.getByRole('button', {name: 'Disable'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByRole('button', {name: 'Edit'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('disables action buttons for an all-projects alert without org:write', async () => {
    const alertWriterOrganization = OrganizationFixture({
      access: ['org:read', 'alerts:read', 'alerts:write'],
    });
    const projectScopeRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/project-scope/',
      body: {projectIds: [], includesAllProjects: true},
    });

    render(<AutomationDetail />, {
      organization: alertWriterOrganization,
      initialRouterConfig: {
        route: '/alerts/:automationId/',
        location: {pathname: '/alerts/123/'},
      },
    });

    await waitFor(() => expect(projectScopeRequest).toHaveBeenCalled());
    expect(screen.getByRole('button', {name: 'Disable'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByRole('button', {name: 'Edit'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('enables action buttons for a team admin of every connected project', async () => {
    const teamAdminOrg = OrganizationFixture({
      access: ['org:read', 'alerts:read'],
    });
    const project = ProjectFixture({
      id: '10',
      access: ['project:read', 'alerts:write'],
    });
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/project-scope/',
      body: {projectIds: [project.id], includesAllProjects: false},
    });

    render(<AutomationDetail />, {
      organization: teamAdminOrg,
      initialRouterConfig: {
        route: '/alerts/:automationId/',
        location: {pathname: '/alerts/123/'},
      },
    });

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Disable'})).toBeEnabled()
    );
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Edit'})).not.toHaveAttribute(
        'aria-disabled',
        'true'
      )
    );
  });

  it('displays connected projects and monitors', async () => {
    const project = ProjectFixture({
      id: '10',
      slug: 'my-project',
      name: 'My Project',
    });
    ProjectsStore.loadInitialData([project]);

    const monitor = MetricDetectorFixture({
      id: '50',
      name: 'CPU Usage Monitor',
      projectId: '10',
    });
    const issueStreamDetector = IssueStreamDetectorFixture({
      id: '60',
      projectId: '10',
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [monitor],
      match: [MockApiClient.matchQuery({query: '!type:issue_stream workflow:123'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [issueStreamDetector],
      match: [MockApiClient.matchQuery({query: 'type:issue_stream workflow:123'})],
    });

    render(<AutomationDetail />, {
      organization,
      initialRouterConfig: {
        route: '/alerts/:automationId/',
        location: {pathname: '/alerts/123/'},
      },
    });

    expect(await screen.findByText('my-project')).toBeInTheDocument();
    expect(await screen.findByText('CPU Usage Monitor')).toBeInTheDocument();
  });

  describe('Seer page context', () => {
    /**
     * Renders the page under a component that captures `getLLMContext`, which
     * is how Seer reads it. Returns a getter for the `alert-detail` node's data.
     */
    function renderAndReadNode() {
      let getLLMContext: ReturnType<typeof useLLMContext>['getLLMContext'] | undefined;
      function Component() {
        // oxlint-disable-next-line react/globals -- Test captures the hook result in an outer variable to assert on it.
        ({getLLMContext} = useLLMContext());
        return <AutomationDetail />;
      }

      render(<Component />, {
        organization,
        initialRouterConfig: {
          route: '/alerts/:automationId/',
          location: {pathname: '/alerts/123/'},
        },
      });

      return () =>
        getLLMContext!().nodes.find(node => node.nodeType === 'alert-detail')?.data as
          | Record<string, unknown>
          | undefined;
    }

    it('reports each action with its resolved target channel', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/123/',
        body: AutomationFixture({
          ...automation,
          actionFilters: [
            ActionFilterFixture({
              actions: [
                ActionFixture({
                  config: {
                    targetType: ActionTarget.SPECIFIC,
                    targetIdentifier: 'C123456',
                    targetDisplay: '#alerts-prod',
                  },
                  data: {untyped: 'integration payload'},
                }),
              ],
            }),
          ],
        }),
      });

      const readNode = renderAndReadNode();
      await screen.findByRole('heading', {name: /Test Automation/i});

      await waitFor(() => {
        const data = readNode();
        expect(data).toBeDefined();
        expect(data!.id).toBe('123');
        expect(data!.statusWarning).toBeNull();
        expect(data!.connectedMonitorIds).toEqual(['1', '2']);
        // Exact match: the channel name is what closes the gap this node exists
        // for, and `data` is an untyped bag that must not reach the prompt.
        expect(data!.actionFilters).toEqual([
          {
            logicType: 'any',
            conditions: [
              {
                type: 'tagged_event',
                comparison: {key: 'name', match: 'co', value: 'moo deng'},
              },
            ],
            actions: [
              {
                type: 'slack',
                targetType: 'specific',
                targetIdentifier: 'C123456',
                targetDisplay: '#alerts-prod',
              },
            ],
          },
        ]);
        // A trigger group has no actions, so it reports none.
        expect(data!.triggers).not.toHaveProperty('actions');
      });
    });

    it('reports the warning when no action can run', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/123/',
        body: AutomationFixture({
          ...automation,
          actionFilters: [
            ActionFilterFixture({actions: [ActionFixture({status: 'disabled'})]}),
          ],
        }),
      });

      const readNode = renderAndReadNode();
      await screen.findByRole('heading', {name: /Test Automation/i});

      await waitFor(() => {
        expect(readNode()!.statusWarning).toBe(
          'Alert is invalid because no actions can run. Actions need to be reconfigured.'
        );
      });
    });
  });
});
