import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import AlertRulesList from 'app/views/alerts/rules';
import ProjectsStore from 'app/stores/projectsStore';

describe('OrganizationRuleList', () => {
  const {routerContext, organization} = initializeOrg();
  let rulesMock;
  let projectMock;

  const createWrapper = async props => {
    const wrapper = mountWithTheme(
      <AlertRulesList
        organization={organization}
        params={{orgId: organization.slug}}
        location={{query: {}, search: ''}}
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

    const items = wrapper.find('AlertRulesPanelItem');
    expect(items).toHaveLength(1);
    expect(items.find('RuleType').text()).toBe('Issue');
    expect(items.find('Title').text()).toBe('First Issue Alert');
    expect(items.find('CreatedBy').text()).toBe('Samwise');

    // GlobalSelectionHeader loads projects + the Projects render-prop
    // component to load projects for all rows.
    expect(projectMock).toHaveBeenCalledTimes(2);

    expect(projectMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {query: 'slug:earth'},
      })
    );
    expect(items.at(0).find('IdBadge').prop('project')).toMatchObject({
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

    // NOTE: A link when not disabled
    const addLink = wrapper.find('a[aria-label="Create Alert Rule"]');
    expect(addLink.props()['aria-disabled']).toBe(false);
  });
});
