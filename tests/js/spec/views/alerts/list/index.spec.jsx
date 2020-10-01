import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import IncidentsList from 'app/views/alerts/list';
import ProjectsStore from 'app/stores/projectsStore';

describe('IncidentsList', function () {
  const {routerContext, organization} = initializeOrg({
    organization: {
      features: ['incidents'],
    },
  });
  let incidentsMock;
  let statsMock;
  let projectMock;
  let wrapper;
  let projects;
  const projects1 = ['a', 'b', 'c'];
  const projects2 = ['c', 'd'];

  const createWrapper = async props => {
    wrapper = mountWithTheme(
      <IncidentsList
        params={{orgId: organization.slug}}
        location={{query: {}, search: ''}}
        {...props}
      />,
      routerContext
    );
    // Wait for sparklines library
    await tick();
    wrapper.update();
    return wrapper;
  };

  beforeEach(function () {
    incidentsMock = MockApiClient.addMockResponse({
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
    statsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/1/stats/',
      body: TestStubs.IncidentStats(),
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

    projects = [
      TestStubs.Project({slug: 'a', platform: 'javascript'}),
      TestStubs.Project({slug: 'b'}),
      TestStubs.Project({slug: 'c'}),
      TestStubs.Project({slug: 'd'}),
    ];

    projectMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: projects,
    });
  });

  afterEach(function () {
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('displays list', async function () {
    ProjectsStore.loadInitialData(projects);
    wrapper = await createWrapper();
    await tick();
    await tick();
    await tick();
    wrapper.update();

    const items = wrapper.find('IncidentPanelItem');

    expect(items).toHaveLength(2);
    expect(items.at(0).text()).toContain('First incident');
    expect(items.at(1).text()).toContain('Second incident');

    // GlobalSelectionHeader loads projects + the Projects render-prop
    // component to load projects for all rows.
    expect(projectMock).toHaveBeenCalledTimes(2);

    expect(projectMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {query: 'slug:a slug:b slug:c'},
      })
    );
    expect(items.at(0).find('IdBadge').prop('project')).toMatchObject({
      slug: 'a',
    });
  });

  it('displays empty state (first time experience)', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/',
      body: [],
    });
    const rulesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rules/',
      body: [],
    });
    const promptsMock = MockApiClient.addMockResponse({
      url: '/promptsactivity/',
      body: {data: {dismissed_ts: null}},
    });
    const promptsUpdateMock = MockApiClient.addMockResponse({
      url: '/promptsactivity/',
      method: 'PUT',
    });

    wrapper = await createWrapper();

    expect(rulesMock).toHaveBeenCalledTimes(1);
    expect(promptsMock).toHaveBeenCalledTimes(1);
    expect(promptsUpdateMock).toHaveBeenCalledTimes(1);

    await tick();
    wrapper.update();

    expect(wrapper.find('PanelItem')).toHaveLength(0);
    expect(wrapper.find('Onboarding').text()).toContain('More signal, less noise');
  });

  it('displays empty state (rules not yet created)', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/',
      body: [],
    });
    const rulesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rules/',
      body: [],
    });
    const promptsMock = MockApiClient.addMockResponse({
      url: '/promptsactivity/',
      body: {data: {dismissed_ts: Math.floor(Date.now() / 1000)}},
    });

    wrapper = await createWrapper();

    expect(rulesMock).toHaveBeenCalledTimes(1);
    expect(promptsMock).toHaveBeenCalledTimes(1);

    await tick();
    wrapper.update();

    expect(wrapper.find('PanelItem')).toHaveLength(0);
    expect(wrapper.text()).toContain('No metric alert rules exist for these projects');
  });

  it('displays empty state (rules created)', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/',
      body: [],
    });
    const rulesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rules/',
      body: [{id: 1}],
    });
    const promptsMock = MockApiClient.addMockResponse({
      url: '/promptsactivity/',
      body: {data: {dismissed_ts: Math.floor(Date.now() / 1000)}},
    });

    wrapper = await createWrapper();

    expect(rulesMock).toHaveBeenCalledTimes(1);
    expect(promptsMock).toHaveBeenCalledTimes(0);

    await tick();
    wrapper.update();

    expect(wrapper.find('PanelItem')).toHaveLength(0);
    expect(wrapper.text()).toContain(
      'There are no unresolved metric alerts in these projects'
    );
  });

  it('toggles open/closed', async function () {
    wrapper = await createWrapper();

    expect(wrapper.find('StyledButtonBar').find('Button').at(0).prop('priority')).toBe(
      'primary'
    );

    expect(wrapper.find('IncidentPanelItem').at(0).find('Duration').exists()).toBeFalsy();

    expect(wrapper.find('IncidentPanelItem').at(0).find('TimeSince')).toHaveLength(1);

    expect(incidentsMock).toHaveBeenCalledTimes(1);

    expect(incidentsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/incidents/',
      expect.objectContaining({query: {status: 'open'}})
    );

    wrapper.setProps({location: {query: {status: 'closed'}, search: '?status=closed`'}});

    expect(wrapper.find('StyledButtonBar').find('Button').at(1).prop('priority')).toBe(
      'primary'
    );

    expect(wrapper.find('IncidentPanelItem').at(0).find('Duration').text()).toBe(
      '2 weeks'
    );

    expect(wrapper.find('IncidentPanelItem').at(0).find('TimeSince')).toHaveLength(2);

    expect(incidentsMock).toHaveBeenCalledTimes(2);
    // Stats not called for closed incidents
    expect(statsMock).toHaveBeenCalledTimes(1);

    expect(incidentsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/incidents/',
      expect.objectContaining({query: expect.objectContaining({status: 'closed'})})
    );
  });

  it('disables the new alert button for members', async function () {
    const noAccessOrg = {
      ...organization,
      access: [],
    };

    wrapper = await createWrapper({organization: noAccessOrg});

    const addButton = wrapper.find('button[aria-label="Create Alert Rule"]');
    expect(addButton.props()['aria-disabled']).toBe(true);

    // Enabled with access
    wrapper = await createWrapper();

    // NOTE: A link when not disabled
    const addLink = wrapper.find('a[aria-label="Create Alert Rule"]');
    expect(addLink.props()['aria-disabled']).toBe(false);
  });
});
