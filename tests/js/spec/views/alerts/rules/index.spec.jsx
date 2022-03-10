import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import AlertRulesList from 'sentry/views/alerts/rules';
import {IncidentStatus} from 'sentry/views/alerts/types';

jest.mock('sentry/utils/analytics/trackAdvancedAnalyticsEvent');

describe('OrganizationRuleList', () => {
  const {routerContext, organization, router} = initializeOrg();
  TeamStore.loadInitialData([], false, null);
  let rulesMock;
  let projectMock;
  const pageLinks =
    '<https://sentry.io/api/0/organizations/org-slug/combined-rules/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
    '<https://sentry.io/api/0/organizations/org-slug/combined-rules/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"';

  const getComponent = props => (
    <AlertRulesList
      organization={organization}
      params={{orgId: organization.slug}}
      location={{query: {}, search: ''}}
      router={router}
      {...props}
    />
  );

  const createWrapper = props => render(getComponent(props), {context: routerContext});

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
        TestStubs.IncidentRule({
          id: '345',
          projects: ['earth'],
          latestIncident: TestStubs.Incident({
            status: IncidentStatus.CRITICAL,
          }),
        }),
        TestStubs.IncidentRule({
          id: '678',
          projects: ['earth'],
          latestIncident: null,
        }),
      ],
    });
    projectMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [TestStubs.Project({slug: 'earth', platform: 'javascript'})],
    });

    act(() => OrganizationStore.onUpdate(organization, {replace: true}));
    act(() => ProjectsStore.loadInitialData([]));
  });

  afterEach(() => {
    act(() => ProjectsStore.reset());
    MockApiClient.clearMockResponses();
    trackAdvancedAnalyticsEvent.mockClear();
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

    expect(trackAdvancedAnalyticsEvent).toHaveBeenCalledWith(
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

  it('sorts by date created', async () => {
    const {rerender} = createWrapper();

    // The created column is not used for sorting
    expect(await screen.findByText('Created')).toHaveAttribute('aria-sort', 'none');

    // Sort by created (date_added)
    rerender(
      getComponent({
        location: {
          query: {asc: '1', sort: 'date_added'},
          search: '?asc=1&sort=date_added`',
        },
      })
    );

    expect(await screen.findByText('Created')).toHaveAttribute('aria-sort', 'ascending');

    expect(rulesMock).toHaveBeenCalledTimes(2);

    expect(rulesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/combined-rules/',
      expect.objectContaining({
        query: expect.objectContaining({asc: '1'}),
      })
    );
  });

  it('sorts by name', async () => {
    const {rerender} = createWrapper();

    // The name column is not used for sorting
    expect(await screen.findByText('Alert Rule')).toHaveAttribute('aria-sort', 'none');

    // Sort by the name column
    rerender(
      getComponent({
        location: {
          query: {asc: '1', sort: 'name'},
          search: '?asc=1&sort=name`',
        },
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

    const {rerender} = createWrapper({organization: noAccessOrg});

    expect(await screen.findByLabelText('Create Alert')).toBeDisabled();

    // Enabled with access
    rerender(getComponent());
    expect(await screen.findByLabelText('Create Alert')).toBeEnabled();
  });

  it('searches by name', async () => {
    createWrapper();

    const search = await screen.findByPlaceholderText('Search by name');
    expect(search).toBeInTheDocument();

    const testQuery = 'test name';
    userEvent.type(search, `${testQuery}{enter}`);

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          name: testQuery,
          expand: ['latestIncident'],
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
      getComponent({location: {query: {team: 'myteams'}, search: '?team=myteams`'}})
    );

    userEvent.click(await screen.findByTestId('filter-button'));

    // Uncheck myteams
    userEvent.click(await screen.findByText('My Teams'));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          expand: ['latestIncident'],
          sort: ['incident_status', 'date_triggered'],
          team: '',
        },
      })
    );
  });

  it('displays alert status', async () => {
    createWrapper();
    const rules = await screen.findAllByText('My Incident Rule');

    expect(rules[0]).toBeInTheDocument();

    expect(screen.getByText('Triggered')).toBeInTheDocument();
    expect(screen.getByText('Above 70')).toBeInTheDocument();
    expect(screen.getByText('Below 36')).toBeInTheDocument();
    expect(screen.getAllByTestId('alert-badge')[0]).toBeInTheDocument();
  });

  it('sorts by alert rule', async () => {
    createWrapper({organization});

    expect(await screen.findByText('First Issue Alert')).toBeInTheDocument();

    expect(rulesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/combined-rules/',
      expect.objectContaining({
        query: {
          expand: ['latestIncident'],
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

    userEvent.click(screen.getByLabelText('Next'));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          expand: ['latestIncident'],
          sort: ['incident_status', 'date_triggered'],
          team: '',
          cursor: '0:100:0',
        },
      })
    );
  });
});
