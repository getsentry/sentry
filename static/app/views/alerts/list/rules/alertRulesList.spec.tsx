import {IncidentFixture} from 'sentry-fixture/incident';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {MetricRuleFixture} from 'sentry-fixture/metricRule';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectAlertRuleFixture} from 'sentry-fixture/projectAlertRule';
import {TeamFixture} from 'sentry-fixture/team';
import {UptimeRuleFixture} from 'sentry-fixture/uptimeRule';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import {CombinedAlertType, IncidentStatus} from 'sentry/views/alerts/types';

import AlertRulesList from './alertRulesList';

jest.mock('sentry/utils/analytics');

describe('AlertRulesList', () => {
  const defaultOrg = OrganizationFixture({
    access: ['alerts:write'],
  });

  TeamStore.loadInitialData([TeamFixture()], false, null);
  let rulesMock!: jest.Mock;
  let projectMock!: jest.Mock;
  const pageLinks =
    '<https://sentry.io/api/0/organizations/org-slug/combined-rules/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
    '<https://sentry.io/api/0/organizations/org-slug/combined-rules/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"';

  beforeEach(() => {
    rulesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [
        {
          ...ProjectAlertRuleFixture({
            id: '123',
            name: 'First Issue Alert',
            projects: ['earth'],
            createdBy: {name: 'Samwise', id: 1, email: ''},
          }),
          type: CombinedAlertType.ISSUE,
        },
        {
          ...MetricRuleFixture({
            id: '345',
            projects: ['earth'],
            latestIncident: IncidentFixture({
              status: IncidentStatus.CRITICAL,
            }),
          }),
          type: CombinedAlertType.METRIC,
        },
        {
          ...MetricRuleFixture({
            id: '678',
            projects: ['earth'],
            latestIncident: null,
          }),
          type: CombinedAlertType.METRIC,
        },
      ],
    });

    projectMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [
        ProjectFixture({
          slug: 'earth',
          platform: 'javascript',
          teams: [TeamFixture()],
        }),
      ],
    });

    act(() => OrganizationStore.onUpdate(defaultOrg, {replace: true}));
    act(() => ProjectsStore.loadInitialData([]));
  });

  afterEach(() => {
    act(() => ProjectsStore.reset());
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('displays list', async () => {
    const {router, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});

    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();

    expect(projectMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({query: 'slug:earth'}),
      })
    );

    expect(screen.getAllByTestId('badge-display-name')[0]).toHaveTextContent('earth');
  });

  it('displays empty state', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      body: [],
    });
    const {router, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});

    expect(
      await screen.findByText('No alert rules found for the current query.')
    ).toBeInTheDocument();

    expect(rulesMock).toHaveBeenCalledTimes(0);
  });

  it('displays team dropdown context if unassigned', async () => {
    const {router, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});
    const assignee = (await screen.findAllByTestId('alert-row-assignee'))[0];
    const btn = within(assignee).getAllByRole('button')[0];

    expect(assignee).toBeInTheDocument();
    expect(btn).toBeInTheDocument();

    await userEvent.click(btn, {skipHover: true});

    expect(screen.getByText('#team-slug')).toBeInTheDocument();
    expect(within(assignee).getByText('Unassigned')).toBeInTheDocument();
  });

  it('assigns rule to team from unassigned', async () => {
    const assignMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/earth/rules/123/',
      body: [],
    });
    const {router, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});

    const assignee = (await screen.findAllByTestId('alert-row-assignee'))[0];
    const btn = within(assignee).getAllByRole('button')[0];

    expect(assignee).toBeInTheDocument();
    expect(btn).toBeInTheDocument();

    await userEvent.click(btn, {skipHover: true});
    await userEvent.click(screen.getByText('#team-slug'));

    expect(assignMock).toHaveBeenCalledWith(
      '/projects/org-slug/earth/rules/123/',
      expect.objectContaining({
        data: expect.objectContaining({owner: 'team:1'}),
      })
    );
  });

  it('displays dropdown context menu with actions', async () => {
    const {router, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});
    const actions = (await screen.findAllByRole('button', {name: 'Actions'}))[0];
    expect(actions).toBeInTheDocument();

    await userEvent.click(actions);

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
  });

  it('deletes an issue rule', async () => {
    const deletedRuleName = 'Issue Rule';
    const issueRule = ProjectAlertRuleFixture({
      name: deletedRuleName,
      projects: ['project-slug'],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [{...issueRule, type: CombinedAlertType.ISSUE}],
    });

    const {router, project, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});
    renderGlobalModal();

    const deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${issueRule.id}/`,
      method: 'DELETE',
      body: {},
    });

    const actions = (await screen.findAllByRole('button', {name: 'Actions'}))[0];

    // Add a new response to the mock with no rules
    const emptyListMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [],
    });

    expect(screen.getByText(deletedRuleName)).toBeInTheDocument();
    await userEvent.click(actions);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Delete'}));
    await userEvent.click(screen.getByRole('button', {name: 'Delete Rule'}));

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(emptyListMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(deletedRuleName)).not.toBeInTheDocument();
  });

  it('deletes a metric rule', async () => {
    const deletedRuleName = 'Metric Rule';
    const metricRule = MetricRuleFixture({
      name: deletedRuleName,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [{...metricRule, type: CombinedAlertType.METRIC}],
    });

    const {router, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});
    renderGlobalModal();

    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${metricRule.id}/`,
      method: 'DELETE',
      body: {},
    });

    const actions = (await screen.findAllByRole('button', {name: 'Actions'}))[0];

    // Add a new response to the mock with no rules
    const emptyListMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [],
    });

    expect(screen.getByText(deletedRuleName)).toBeInTheDocument();
    await userEvent.click(actions);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Delete'}));
    await userEvent.click(screen.getByRole('button', {name: 'Delete Rule'}));

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(emptyListMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(deletedRuleName)).not.toBeInTheDocument();
  });

  it('sends user to new alert page on duplicate action', async () => {
    const {organization, router} = initializeOrg({
      organization: defaultOrg,
    });
    render(<AlertRulesList />, {router, organization});
    const actions = (await screen.findAllByRole('button', {name: 'Actions'}))[0];
    expect(actions).toBeInTheDocument();

    await userEvent.click(actions);

    const duplicate = await screen.findByText('Duplicate');
    expect(duplicate).toBeInTheDocument();

    await userEvent.click(duplicate);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/alerts/new/issue/',
      query: {
        createFromDuplicate: 'true',
        duplicateRuleId: '123',
        project: 'earth',
        referrer: 'alert_stream',
      },
    });
  });

  it('sorts by name', async () => {
    const {router, organization} = initializeOrg({
      organization: defaultOrg,
      router: {
        location: LocationFixture({
          query: {asc: '1', sort: 'name'},
          // Sort by the name column
          search: '?asc=1&sort=name`',
        }),
      },
    });
    render(<AlertRulesList />, {router, organization});

    expect(await screen.findByText('Alert Rule')).toHaveAttribute(
      'aria-sort',
      'ascending'
    );

    expect(rulesMock).toHaveBeenCalledTimes(1);
    expect(rulesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/combined-rules/',
      expect.objectContaining({
        query: expect.objectContaining({sort: 'name', asc: '1'}),
      })
    );
  });

  it('disables the new alert button for members', async () => {
    const noAccessOrg = {
      ...defaultOrg,
      access: [],
    };
    const {router, organization} = initializeOrg({organization: noAccessOrg});
    render(<AlertRulesList />, {router, organization});

    expect(await screen.findByLabelText('Create Alert')).toBeDisabled();
  });

  it('searches by name', async () => {
    const {organization, router} = initializeOrg();
    render(<AlertRulesList />, {router, organization});

    const search = await screen.findByPlaceholderText('Search by name');
    expect(search).toBeInTheDocument();

    const testQuery = 'test name';
    await userEvent.type(search, `${testQuery}{enter}`);

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          name: testQuery,
        },
      })
    );
  });

  it('uses empty team query parameter when removing all teams', async () => {
    const {organization, router} = initializeOrg({
      router: {
        location: LocationFixture({
          query: {team: 'myteams'},
          search: '?team=myteams`',
        }),
      },
    });
    render(<AlertRulesList />, {router, organization});

    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', {name: 'My Teams'}));

    // Uncheck myteams
    const myTeams = await screen.findAllByText('My Teams');
    await userEvent.click(myTeams[1]);

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          team: '',
        },
      })
    );
  });

  it('displays metric alert status', async () => {
    const {router, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});
    const rules = await screen.findAllByText('My Incident Rule');

    expect(rules[0]).toBeInTheDocument();

    expect(screen.getByText('Triggered')).toBeInTheDocument();
    expect(screen.getByText('Above 70')).toBeInTheDocument(); // the fixture trigger threshold
    expect(screen.getByText('Below 36')).toBeInTheDocument(); // the fixture resolved threshold
    expect(screen.getAllByTestId('alert-badge')[0]).toBeInTheDocument();
  });

  it('displays activated metric alert status', async () => {
    rulesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [
        {
          ...MetricRuleFixture({
            id: '1',
            projects: ['earth'],
            name: 'Active Activated Alert',
            monitorType: 1,
            activationCondition: 0,
            activations: [
              {
                alertRuleId: '1',
                dateCreated: '2021-08-01T00:00:00Z',
                finishedAt: '',
                id: '1',
                isComplete: false,
                querySubscriptionId: '1',
                activator: '123',
                conditionType: '0',
              },
            ],
            latestIncident: IncidentFixture({
              status: IncidentStatus.CRITICAL,
            }),
          }),
          type: CombinedAlertType.METRIC,
        },
        {
          ...MetricRuleFixture({
            id: '2',
            projects: ['earth'],
            name: 'Ready Activated Alert',
            monitorType: 1,
            activationCondition: 0,
          }),
          type: CombinedAlertType.METRIC,
        },
      ],
    });
    const {router, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});

    expect(await screen.findByText('Active Activated Alert')).toBeInTheDocument();
    expect(await screen.findByText('Ready Activated Alert')).toBeInTheDocument();

    expect(screen.getByText('Last activated')).toBeInTheDocument();
    expect(screen.getByText('Alert has not been activated yet')).toBeInTheDocument();
    expect(screen.getByText('Above 70')).toBeInTheDocument(); // the fixture trigger threshold
    expect(screen.getByText('Below 70')).toBeInTheDocument(); // Alert has never fired, so no resolved threshold
    expect(screen.getAllByTestId('alert-badge')[0]).toBeInTheDocument();
  });

  it('displays issue alert disabled', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [
        {
          ...ProjectAlertRuleFixture({
            name: 'First Issue Alert',
            projects: ['earth'],
            status: 'disabled',
          }),
          type: CombinedAlertType.ISSUE,
        },
      ],
    });
    const {router, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});
    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('displays issue alert disabled instead of muted', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [
        {
          ...ProjectAlertRuleFixture({
            name: 'First Issue Alert',
            projects: ['earth'],
            // both disabled and muted
            status: 'disabled',
            snooze: true,
          }),
          type: CombinedAlertType.ISSUE,
        },
      ],
    });
    const {router, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});
    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    expect(screen.queryByText('Muted')).not.toBeInTheDocument();
  });

  it('displays issue alert muted', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [
        {
          ...ProjectAlertRuleFixture({
            name: 'First Issue Alert',
            projects: ['earth'],
            snooze: true,
          }),
          type: CombinedAlertType.ISSUE,
        },
      ],
    });
    const {router, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});
    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();
    expect(screen.getByText('Muted')).toBeInTheDocument();
  });

  it('displays metric alert muted', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [
        {
          ...MetricRuleFixture({
            projects: ['earth'],
            snooze: true,
          }),
          type: CombinedAlertType.METRIC,
        },
      ],
    });
    const {router, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});
    expect(await screen.findByText('My Incident Rule')).toBeInTheDocument();
    expect(screen.getByText('Muted')).toBeInTheDocument();
  });

  it('sorts by alert rule', async () => {
    const {router, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});

    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();

    expect(rulesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/combined-rules/',
      expect.objectContaining({
        query: {
          expand: ['latestIncident', 'lastTriggered'],
          sort: ['incident_status', 'date_triggered'],
          team: ['myteams', 'unassigned'],
        },
      })
    );
  });

  it('preserves empty team query parameter on pagination', async () => {
    const {organization, router} = initializeOrg({
      organization: defaultOrg,
    });
    render(<AlertRulesList />, {router, organization});
    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Next'));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          team: '',
          cursor: '0:100:0',
        },
      })
    );
  });

  it('renders ACTIVATED Metric Alerts', async () => {
    rulesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [
        {
          ...ProjectAlertRuleFixture({
            id: '123',
            name: 'First Issue Alert',
            projects: ['earth'],
            createdBy: {name: 'Samwise', id: 1, email: ''},
          }),
          type: CombinedAlertType.ISSUE,
        },
        {
          ...MetricRuleFixture({
            id: '345',
            projects: ['earth'],
            name: 'activated Test Metric Alert',
            monitorType: 1,
            latestIncident: IncidentFixture({
              status: IncidentStatus.CRITICAL,
            }),
          }),
          type: CombinedAlertType.METRIC,
        },
        {
          ...MetricRuleFixture({
            id: '678',
            name: 'Test Metric Alert 2',
            monitorType: 0,
            projects: ['earth'],
            latestIncident: null,
          }),
          type: CombinedAlertType.METRIC,
        },
      ],
    });

    const {router, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});

    expect(await screen.findByText('Test Metric Alert 2')).toBeInTheDocument();
    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();
    expect(await screen.findByText('activated Test Metric Alert')).toBeInTheDocument();
  });

  it('renders uptime alert rules', async () => {
    rulesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [
        {
          ...UptimeRuleFixture({owner: undefined}),
          type: CombinedAlertType.UPTIME,
        },
      ],
    });

    const {router, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});

    expect(await screen.findByText('Uptime Rule')).toBeInTheDocument();
    expect(await screen.findByText('Auto Detected')).toBeInTheDocument();
    expect(await screen.findByText('Up')).toBeInTheDocument();
  });

  it('deletes an uptime rule', async () => {
    const deletedRuleName = 'Uptime Rule';
    const uptimeRule = UptimeRuleFixture({owner: undefined});

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [{...uptimeRule, type: CombinedAlertType.UPTIME}],
    });

    const {router, project, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {router, organization});
    renderGlobalModal();

    const deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/${uptimeRule.id}/`,
      method: 'DELETE',
      body: {},
    });

    const actions = (await screen.findAllByRole('button', {name: 'Actions'}))[0];

    // Add a new response to the mock with no rules
    const emptyListMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [],
    });

    expect(
      screen.getByRole('link', {name: 'Uptime Rule Auto Detected'})
    ).toBeInTheDocument();
    await userEvent.click(actions);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Delete'}));
    await userEvent.click(screen.getByRole('button', {name: 'Delete Rule'}));

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(emptyListMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(deletedRuleName)).not.toBeInTheDocument();
  });
});
