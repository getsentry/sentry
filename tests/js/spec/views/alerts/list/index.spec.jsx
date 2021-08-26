import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectsStore from 'app/stores/projectsStore';
import TeamStore from 'app/stores/teamStore';
import IncidentsList from 'app/views/alerts/list';

describe('IncidentsList', function () {
  let routerContext;
  let router;
  let organization;
  let projectMock;
  let wrapper;
  let projects;
  const projects1 = ['a', 'b', 'c'];
  const projects2 = ['c', 'd'];

  const createWrapper = async (props = {}) => {
    wrapper = mountWithTheme(
      <IncidentsList
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

  beforeEach(function () {
    const context = initializeOrg({
      organization: {
        features: ['incidents'],
      },
    });
    routerContext = context.routerContext;
    router = context.router;
    organization = context.organization;

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
    wrapper.unmount();
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

    const items = wrapper.find('AlertListRow');

    expect(items).toHaveLength(2);
    expect(items.at(0).text()).toContain('First incident');
    expect(items.at(1).text()).toContain('Second incident');

    // GlobalSelectionHeader loads projects + the Projects render-prop
    // component to load projects for all rows.
    expect(projectMock).toHaveBeenCalledTimes(2);

    expect(projectMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({query: 'slug:a slug:b slug:c'}),
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
      url: '/prompts-activity/',
      body: {data: {dismissed_ts: null}},
    });
    const promptsUpdateMock = MockApiClient.addMockResponse({
      url: '/prompts-activity/',
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
      url: '/prompts-activity/',
      body: {data: {dismissed_ts: Math.floor(Date.now() / 1000)}},
    });

    wrapper = await createWrapper();

    expect(rulesMock).toHaveBeenCalledTimes(1);
    expect(promptsMock).toHaveBeenCalledTimes(1);

    await tick();
    wrapper.update();

    expect(wrapper.find('PanelItem')).toHaveLength(0);
    expect(wrapper.text()).toContain('No incidents exist for the current query');
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
      url: '/prompts-activity/',
      body: {data: {dismissed_ts: Math.floor(Date.now() / 1000)}},
    });

    wrapper = await createWrapper();

    expect(rulesMock).toHaveBeenCalledTimes(1);
    expect(promptsMock).toHaveBeenCalledTimes(0);

    await tick();
    wrapper.update();

    expect(wrapper.find('PanelItem')).toHaveLength(0);
    expect(wrapper.text()).toContain('No incidents exist for the current query');
  });

  it('filters by opened issues', async function () {
    ProjectsStore.loadInitialData(projects);
    wrapper = await createWrapper();

    wrapper.find('[data-test-id="filter-button"]').at(1).simulate('click');

    const resolved = wrapper.find('Filter').find('ListItem').at(1);
    expect(resolved.text()).toBe('Resolved');
    expect(resolved.find('[data-test-id="checkbox-fancy"]').props()['aria-checked']).toBe(
      false
    );

    wrapper.setProps({
      location: {query: {status: ['closed']}, search: '?status=closed`'},
    });

    expect(
      wrapper
        .find('Filter')
        .find('ListItem')
        .at(1)
        .find('[data-test-id="checkbox-fancy"]')
        .props()['aria-checked']
    ).toBe(true);
  });

  it('disables the new alert button for those without alert:write', async function () {
    const noAccessOrg = {
      ...organization,
      access: [],
    };

    wrapper = await createWrapper({organization: noAccessOrg});

    const addButton = wrapper.find('button[aria-label="Create Alert Rule"]');
    expect(addButton.props()['aria-disabled']).toBe(true);

    // Enabled with access
    wrapper.unmount();
    wrapper = await createWrapper();

    const addLink = wrapper.find('button[aria-label="Create Alert Rule"]');
    expect(addLink.props()['aria-disabled']).toBe(false);
  });

  it('searches by name', async () => {
    wrapper = await createWrapper();
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
          title: testQuery,
          team: ['myteams', 'unassigned'],
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
          alertRule: TestStubs.IncidentRule({owner: `team:${team.id}`}),
        }),
      ],
    });
    TeamStore.getById = jest.fn().mockReturnValue(team);
    const org = {
      ...organization,
      features: ['incidents', 'team-alerts-ownership'],
    };

    wrapper = await createWrapper({organization: org});
    expect(wrapper.find('TeamWrapper').text()).toBe(team.name);
    expect(wrapper).toSnapshot();
  });
});
