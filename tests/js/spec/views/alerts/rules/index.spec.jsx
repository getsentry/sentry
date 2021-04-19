import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectsStore from 'app/stores/projectsStore';
import AlertRulesList from 'app/views/alerts/rules';
import {IncidentStatus} from 'app/views/alerts/types';

describe('OrganizationRuleList', () => {
  const {routerContext, organization, router} = initializeOrg();
  let rulesMock;
  let projectMock;

  const createWrapper = async props => {
    const wrapper = mountWithTheme(
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
    return wrapper;
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
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('displays list', async () => {
    const wrapper = await createWrapper();

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
  });

  it('displays empty state', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      body: [],
    });

    const wrapper = await createWrapper();

    expect(rulesMock).toHaveBeenCalledTimes(0);

    await tick();
    wrapper.update();

    expect(wrapper.find('PanelItem')).toHaveLength(0);
    expect(wrapper.text()).toContain('No alert rules exist for these projects');
  });

  it('sorts by date created', async () => {
    const wrapper = await createWrapper();

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
    const wrapper = await createWrapper();

    const nameHeader = wrapper.find('StyledSortLink').first();
    expect(nameHeader.text()).toContain('Alert Name');
    expect(nameHeader.props().to).toEqual(
      expect.objectContaining({
        query: {
          sort: 'name',
          asc: undefined,
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

    let wrapper = await createWrapper({organization: noAccessOrg});

    const addButton = wrapper.find('button[aria-label="Create Alert Rule"]');
    expect(addButton.props()['aria-disabled']).toBe(true);

    // Enabled with access
    wrapper = await createWrapper();

    const addLink = wrapper.find('button[aria-label="Create Alert Rule"]');
    expect(addLink.props()['aria-disabled']).toBe(false);
  });

  it('searches by name', async () => {
    const ownershipOrg = {
      ...organization,
      features: ['team-alerts-ownership'],
    };
    const wrapper = await createWrapper({organization: ownershipOrg});
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
        },
      })
    );
  });

  it('displays alert status', async () => {
    const ownershipOrg = {
      ...organization,
      features: ['alert-list', 'incidents'],
    };
    const wrapper = await createWrapper({organization: ownershipOrg});
    let row = wrapper.find('RuleListRow').at(1);
    expect(row.find('AlertNameAndStatus').text()).toContain('My Incident Rule');
    expect(row.find('AlertNameAndStatus').text()).toContain('Triggered');
    expect(row.find('TriggerText').text()).toBe('Above 70');

    row = wrapper.find('RuleListRow').at(2);
    expect(row.find('TriggerText').text()).toBe('Below 70');
    expect(wrapper.find('AlertIconWrapper').exists()).toBe(true);
  });

  it('sorts by alert rule with alert-list', async () => {
    const ownershipOrg = {
      ...organization,
      features: ['alert-list', 'incidents'],
    };
    await createWrapper({organization: ownershipOrg});

    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          expand: ['latestIncident'],
          sort: ['incident_status', 'date_triggered'],
        }),
      })
    );
  });
});
