import type {Location} from 'history';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import AlertRulesList from 'sentry/views/alerts/list/rules';
import {IncidentStatus} from 'sentry/views/alerts/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/analytics');

describe('AlertRulesList', () => {
  const {routerContext, organization, router} = initializeOrg({
    organization: {
      access: ['alerts:write'],
    },
  });
  TeamStore.loadInitialData([TestStubs.Team()], false, null);
  let rulesMock;
  let projectMock;
  const pageLinks =
    '<https://sentry.io/api/0/organizations/org-slug/combined-rules/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
    '<https://sentry.io/api/0/organizations/org-slug/combined-rules/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"';

  const getComponent = (
    props: {location?: Location; organization?: Organization} = {}
  ) => (
    <OrganizationContext.Provider value={props.organization ?? organization}>
      <AlertRulesList
        {...TestStubs.routeComponentProps()}
        organization={props.organization ?? organization}
        params={{}}
        location={TestStubs.location({query: {}, search: ''})}
        router={router}
        {...props}
      />
    </OrganizationContext.Provider>
  );

  const createWrapper = (props = {}) =>
    render(getComponent(props), {context: routerContext});

  beforeEach(() => {
    rulesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [
        TestStubs.ProjectAlertRule({
          id: '123',
          name: 'First Issue Alert',
          projects: ['earth'],
          createdBy: {name: 'Samwise', id: 1, email: ''},
        }),
        TestStubs.MetricRule({
          id: '345',
          projects: ['earth'],
          latestIncident: TestStubs.Incident({
            status: IncidentStatus.CRITICAL,
          }),
        }),
        TestStubs.MetricRule({
          id: '678',
          projects: ['earth'],
          latestIncident: null,
        }),
      ],
    });
    projectMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [
        TestStubs.Project({
          slug: 'earth',
          platform: 'javascript',
          teams: [TestStubs.Team()],
        }),
      ],
    });

    act(() => OrganizationStore.onUpdate(organization, {replace: true}));
    act(() => ProjectsStore.loadInitialData([]));
  });

  afterEach(() => {
    act(() => ProjectsStore.reset());
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('displays list', async () => {
    createWrapper();

    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();

    expect(projectMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({query: 'slug:earth'}),
      })
    );

    expect(screen.getAllByTestId('badge-display-name')[0]).toHaveTextContent('earth');

    expect(trackAnalytics).toHaveBeenCalledWith(
      'alert_rules.viewed',
      expect.objectContaining({
        sort: 'incident_status,date_triggered',
      })
    );
  });

  it('displays empty state', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      body: [],
    });

    createWrapper();

    expect(
      await screen.findByText('No alert rules found for the current query.')
    ).toBeInTheDocument();

    expect(rulesMock).toHaveBeenCalledTimes(0);
  });

  it('displays team dropdown context if unassigned', async () => {
    createWrapper();
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
    createWrapper();
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
    createWrapper();
    const actions = (await screen.findAllByRole('button', {name: 'Actions'}))[0];
    expect(actions).toBeInTheDocument();

    await userEvent.click(actions);

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
  });

  it('sends user to new alert page on duplicate action', async () => {
    createWrapper();
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
    const {rerender} = createWrapper();

    // The name column is not used for sorting
    expect(await screen.findByText('Alert Rule')).toHaveAttribute('aria-sort', 'none');

    // Sort by the name column
    rerender(
      getComponent({
        location: TestStubs.location({
          query: {asc: '1', sort: 'name'},
          search: '?asc=1&sort=name`',
        }),
      })
    );

    expect(await screen.findByText('Alert Rule')).toHaveAttribute(
      'aria-sort',
      'ascending'
    );

    expect(rulesMock).toHaveBeenCalledTimes(2);

    expect(rulesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/combined-rules/',
      expect.objectContaining({
        query: expect.objectContaining({sort: 'name', asc: '1'}),
      })
    );
  });

  it('disables the new alert button for members', async () => {
    const noAccessOrg = {
      ...organization,
      access: [],
    };

    render(getComponent({organization: noAccessOrg}), {
      context: TestStubs.routerContext([{organization: noAccessOrg}]),
      organization: noAccessOrg,
    });

    expect(await screen.findByLabelText('Create Alert')).toBeDisabled();
  });

  it('searches by name', async () => {
    createWrapper();

    const search = await screen.findByPlaceholderText('Search by name');
    expect(search).toBeInTheDocument();

    const testQuery = 'test name';
    await userEvent.type(search, `${testQuery}{enter}`);

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          name: testQuery,
          expand: ['latestIncident', 'lastTriggered'],
          sort: ['incident_status', 'date_triggered'],
          team: ['myteams', 'unassigned'],
        },
      })
    );
  });

  it('uses empty team query parameter when removing all teams', async () => {
    const {rerender} = createWrapper();

    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();

    rerender(
      getComponent({
        location: TestStubs.location({
          query: {team: 'myteams'},
          search: '?team=myteams`',
        }),
      })
    );

    await userEvent.click(await screen.findByRole('button', {name: 'My Teams'}));

    // Uncheck myteams
    const myTeams = await screen.findAllByText('My Teams');
    await userEvent.click(myTeams[1]);

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          expand: ['latestIncident', 'lastTriggered'],
          sort: ['incident_status', 'date_triggered'],
          team: '',
        },
      })
    );
  });

  it('displays metric alert status', async () => {
    createWrapper();
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
        TestStubs.ProjectAlertRule({
          name: 'First Issue Alert',
          projects: ['earth'],
          status: 'disabled',
        }),
      ],
    });
    createWrapper();
    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('displays issue alert disabled instead of muted', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [
        TestStubs.ProjectAlertRule({
          name: 'First Issue Alert',
          projects: ['earth'],
          // both disabled and muted
          status: 'disabled',
          snooze: true,
        }),
      ],
    });
    createWrapper();
    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    expect(screen.queryByText('Muted')).not.toBeInTheDocument();
  });

  it('displays issue alert muted', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      headers: {Link: pageLinks},
      body: [
        TestStubs.ProjectAlertRule({
          name: 'First Issue Alert',
          projects: ['earth'],
          snooze: true,
        }),
      ],
    });
    createWrapper();
    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();
    expect(screen.getByText('Muted')).toBeInTheDocument();
  });

  it('sorts by alert rule', async () => {
    createWrapper({organization});

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
    createWrapper({
      organization,
      location: {query: {team: ''}, search: '?team=`'},
    });
    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Next'));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          expand: ['latestIncident', 'lastTriggered'],
          sort: ['incident_status', 'date_triggered'],
          team: '',
          cursor: '0:100:0',
        },
      })
    );
  });
});
