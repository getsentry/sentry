import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectsStore from 'app/stores/projectsStore';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import AlertRulesList from 'app/views/alerts/rules';
import {IncidentStatus} from 'app/views/alerts/types';

jest.mock('app/utils/analytics');

describe('OrganizationRuleList', () => {
  const {routerContext, organization, router} = initializeOrg();
  let rulesMock;
  let projectMock;
  let wrapper;

  const createWrapper = async props => {
    wrapper = mountWithTheme(
      <AlertRulesList
        organization={organization}
        params={{orgId: organization.slug}}
        location={{query: {}, search: ''}}
        router={router}
        {...props}
      />,
      routerContext
    );
    await tick();
    wrapper.update();
  };

  beforeEach(() => {
    rulesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
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

    ProjectsStore.loadInitialData([]);
  });

  afterEach(() => {
    wrapper.unmount();
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
    trackAnalyticsEvent.mockClear();
  });

  it('displays list', async () => {
    await createWrapper();

    const row = wrapper.find('RuleListRow').at(0);
    expect(row.find('RuleType').at(0).text()).toBe('Issue');
    expect(row.find('Title').text()).toBe('First Issue Alert');
    expect(row.find('CreatedBy').text()).toBe('Samwise');

    // GlobalSelectionHeader loads projects + the Projects render-prop
    // component to load projects for all rows.
    expect(projectMock).toHaveBeenCalledTimes(2);

    expect(projectMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({query: 'slug:earth'}),
      })
    );
    expect(wrapper.find('IdBadge').at(0).prop('project')).toMatchObject({
      slug: 'earth',
    });
    expect(trackAnalyticsEvent).toHaveBeenCalledWith({
      eventKey: 'alert_rules.viewed',
      eventName: 'Alert Rules: Viewed',
      organization_id: '3',
      sort: undefined,
    });
  });

  it('displays empty state', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      body: [],
    });

    await createWrapper();

    expect(rulesMock).toHaveBeenCalledTimes(0);

    expect(wrapper.find('PanelItem')).toHaveLength(0);
    expect(wrapper.text()).toContain('No alert rules found for the current query');
  });

  it('sorts by date created', async () => {
    await createWrapper();

    expect(wrapper.find('IconArrow').prop('direction')).toBe('down');

    wrapper.setProps({
      location: {query: {asc: '1'}, search: '?asc=1`'},
    });

    expect(wrapper.find('IconArrow').prop('direction')).toBe('up');

    expect(rulesMock).toHaveBeenCalledTimes(2);

    expect(rulesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/combined-rules/',
      expect.objectContaining({query: expect.objectContaining({asc: '1'})})
    );
  });

  it('sorts by name', async () => {
    await createWrapper();

    const nameHeader = wrapper.find('StyledSortLink').first();
    expect(nameHeader.text()).toContain('Alert Name');
    expect(nameHeader.props().to).toEqual(
      expect.objectContaining({
        query: {
          sort: 'name',
          asc: undefined,
          team: ['myteams', 'unassigned'],
        },
      })
    );

    wrapper.setProps({
      location: {query: {sort: 'name'}, search: '?asc=1&sort=name`'},
    });

    expect(wrapper.find('StyledSortLink').first().props().to).toEqual(
      expect.objectContaining({
        query: {
          sort: 'name',
          asc: '1',
        },
      })
    );
  });

  it('disables the new alert button for members', async () => {
    const noAccessOrg = {
      ...organization,
      access: [],
    };

    await createWrapper({organization: noAccessOrg});

    const addButton = wrapper.find('button[aria-label="Create Alert Rule"]');
    expect(addButton.props()['aria-disabled']).toBe(true);
    wrapper.unmount();

    // Enabled with access
    await createWrapper();

    const addLink = wrapper.find('button[aria-label="Create Alert Rule"]');
    expect(addLink.props()['aria-disabled']).toBe(false);
  });

  it('searches by name', async () => {
    await createWrapper();
    expect(wrapper.find('StyledSearchBar').exists()).toBe(true);

    const testQuery = 'test name';
    wrapper
      .find('StyledSearchBar')
      .find('input')
      .simulate('change', {target: {value: testQuery}})
      .simulate('submit', {preventDefault() {}});

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          name: testQuery,
          team: ['myteams', 'unassigned'],
        },
      })
    );
  });

  it('uses empty team query parameter when removing all teams', async () => {
    await createWrapper();

    wrapper.setProps({
      location: {query: {team: 'myteams'}, search: '?team=myteams`'},
    });
    wrapper.find('Button[data-test-id="filter-button"]').simulate('click');
    // Uncheck myteams
    const myTeamsItem = wrapper.find('Filter').find('ListItem').at(0);
    expect(myTeamsItem.text()).toBe('My Teams');
    myTeamsItem.simulate('click');

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          team: '',
        },
      })
    );
  });

  it('displays alert status', async () => {
    const ownershipOrg = {
      ...organization,
      features: ['alert-details-redesign'],
    };
    await createWrapper({organization: ownershipOrg});
    let row = wrapper.find('RuleListRow').at(1);
    expect(row.find('AlertNameAndStatus').text()).toContain('My Incident Rule');
    expect(row.find('AlertNameAndStatus').text()).toContain('Triggered');
    expect(row.find('TriggerText').text()).toBe('Above 70');

    row = wrapper.find('RuleListRow').at(2);
    expect(row.find('TriggerText').text()).toBe('Below 70');
    expect(wrapper.find('AlertIconWrapper').exists()).toBe(true);
  });

  it('sorts by alert rule with alert-details-redesign', async () => {
    const ownershipOrg = {
      ...organization,
      features: ['alert-details-redesign'],
    };
    await createWrapper({organization: ownershipOrg});

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
});
