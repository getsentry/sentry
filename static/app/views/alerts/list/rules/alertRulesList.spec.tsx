import {Incident} from 'sentry-fixture/incident';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {MetricRule} from 'sentry-fixture/metricRule';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {
  ProjectAlertRule,
  ProjectAlertRule as ProjectAlertRuleFixture,
} from 'sentry-fixture/projectAlertRule';
import {Team} from 'sentry-fixture/team';

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
import {IncidentStatus} from 'sentry/views/alerts/types';

import AlertRulesList from './alertRulesList';

jest.mock('sentry/utils/analytics');

describe('AlertRulesList', () => {
  const defaultOrg = Organization({
    access: ['alerts:write'],
  });
  TeamStore.loadInitialData([Team()], false, null);
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
        ProjectAlertRule({
          id: '123',
          name: 'First Issue Alert',
          projects: ['earth'],
          createdBy: {name: 'Samwise', id: 1, email: ''},
        }),
        MetricRule({
          id: '345',
          projects: ['earth'],
          latestIncident: Incident({
            status: IncidentStatus.CRITICAL,
          }),
        }),
        MetricRule({
          id: '678',
          projects: ['earth'],
          latestIncident: null,
        }),
      ],
    });
    projectMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [
        ProjectFixture({
          slug: 'earth',
          platform: 'javascript',
          teams: [Team()],
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
    const {routerContext, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {context: routerContext, organization});

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
    const {routerContext, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {context: routerContext, organization});

    expect(
      await screen.findByText('No alert rules found for the current query.')
    ).toBeInTheDocument();

    expect(rulesMock).toHaveBeenCalledTimes(0);
  });

  it('displays team dropdown context if unassigned', async () => {
    const {routerContext, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {context: routerContext, organization});
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
    const {routerContext, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {context: routerContext, organization});

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
    const {routerContext, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {context: routerContext, organization});
    const actions = (await screen.findAllByRole('button', {name: 'Actions'}))[0];
    expect(actions).toBeInTheDocument();

    await userEvent.click(actions);

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
  });

  it('deletes a rule', async () => {
    const {routerContext, organization} = initializeOrg({
      organization: defaultOrg,
    });
    const deletedRuleName = 'First Issue Alert';
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [
        ProjectAlertRuleFixture({
          id: '123',
          name: deletedRuleName,
          projects: ['earth'],
          createdBy: {name: 'Samwise', id: 1, email: ''},
        }),
      ],
    });
    const deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/earth/rules/123/`,
      method: 'DELETE',
      body: {},
    });

    render(<AlertRulesList />, {context: routerContext, organization});
    renderGlobalModal();

    const actions = (await screen.findAllByRole('button', {name: 'Actions'}))[0];

    // Add a new response to the mock with no rules
    const emptyListMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [],
    });

    expect(screen.queryByText(deletedRuleName)).toBeInTheDocument();
    await userEvent.click(actions);
    await userEvent.click(screen.getByText('Delete'));
    await userEvent.click(screen.getByRole('button', {name: 'Delete Rule'}));

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(emptyListMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(deletedRuleName)).not.toBeInTheDocument();
  });

  it('sends user to new alert page on duplicate action', async () => {
    const {routerContext, organization, router} = initializeOrg({
      organization: defaultOrg,
    });
    render(<AlertRulesList />, {context: routerContext, organization});
    const actions = (await screen.findAllByRole('button', {name: 'Actions'}))[0];
    expect(actions).toBeInTheDocument();

    await userEvent.click(actions);

    const duplicate = await screen.findByText('Duplicate');
    expect(duplicate).toBeInTheDocument();

    await userEvent.click(duplicate);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/alerts/new/issue/',
      query: {
        createFromDuplicate: true,
        duplicateRuleId: '123',
        project: 'earth',
        referrer: 'alert_stream',
      },
    });
  });

  it('sorts by name', async () => {
    const {routerContext, organization} = initializeOrg({
      organization: defaultOrg,
      router: {
        location: LocationFixture({
          query: {asc: '1', sort: 'name'},
          // Sort by the name column
          search: '?asc=1&sort=name`',
        }),
      },
    });
    render(<AlertRulesList />, {context: routerContext, organization});

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
    const {routerContext, organization} = initializeOrg({organization: noAccessOrg});
    render(<AlertRulesList />, {context: routerContext, organization});

    expect(await screen.findByLabelText('Create Alert')).toBeDisabled();
  });

  it('searches by name', async () => {
    const {routerContext, organization, router} = initializeOrg();
    render(<AlertRulesList />, {context: routerContext, organization});

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
    const {routerContext, organization, router} = initializeOrg({
      router: {
        location: LocationFixture({
          query: {team: 'myteams'},
          search: '?team=myteams`',
        }),
      },
    });
    render(<AlertRulesList />, {context: routerContext, organization});

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
    const {routerContext, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {context: routerContext, organization});
    const rules = await screen.findAllByText('My Incident Rule');

    expect(rules[0]).toBeInTheDocument();

    expect(screen.getByText('Triggered')).toBeInTheDocument();
    expect(screen.getByText('Above 70')).toBeInTheDocument();
    expect(screen.getByText('Below 36')).toBeInTheDocument();
    expect(screen.getAllByTestId('alert-badge')[0]).toBeInTheDocument();
  });

  it('displays issue alert disabled', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [
        ProjectAlertRule({
          name: 'First Issue Alert',
          projects: ['earth'],
          status: 'disabled',
        }),
      ],
    });
    const {routerContext, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {context: routerContext, organization});
    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('displays issue alert disabled instead of muted', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [
        ProjectAlertRule({
          name: 'First Issue Alert',
          projects: ['earth'],
          // both disabled and muted
          status: 'disabled',
          snooze: true,
        }),
      ],
    });
    const {routerContext, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {context: routerContext, organization});
    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    expect(screen.queryByText('Muted')).not.toBeInTheDocument();
  });

  it('displays issue alert muted', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [
        ProjectAlertRule({
          name: 'First Issue Alert',
          projects: ['earth'],
          snooze: true,
        }),
      ],
    });
    const {routerContext, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {context: routerContext, organization});
    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();
    expect(screen.getByText('Muted')).toBeInTheDocument();
  });

  it('displays metric alert muted', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [
        MetricRule({
          projects: ['earth'],
          snooze: true,
        }),
      ],
    });
    const {routerContext, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {context: routerContext, organization});
    expect(await screen.findByText('My Incident Rule')).toBeInTheDocument();
    expect(screen.getByText('Muted')).toBeInTheDocument();
  });

  it('sorts by alert rule', async () => {
    const {routerContext, organization} = initializeOrg({organization: defaultOrg});
    render(<AlertRulesList />, {context: routerContext, organization});

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
    const {routerContext, organization, router} = initializeOrg({
      organization: defaultOrg,
    });
    render(<AlertRulesList />, {context: routerContext, organization});
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
});
