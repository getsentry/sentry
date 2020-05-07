import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import IncidentsList from 'app/views/alerts/list';
import ProjectsStore from 'app/stores/projectsStore';

describe('IncidentsList', function() {
  const {routerContext, organization} = initializeOrg();
  let mock;
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

  beforeEach(function() {
    mock = MockApiClient.addMockResponse({
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
      url: '/organizations/org-slug/incidents/1/stats/',
      body: TestStubs.IncidentStats(),
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/2/stats/',
      body: TestStubs.IncidentStats({totalEvents: 1000, uniqueUsers: 32}),
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

  afterEach(function() {
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('displays list', async function() {
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
    expect(
      items
        .at(0)
        .find('IdBadge')
        .prop('project')
    ).toMatchObject({
      slug: 'a',
    });

    expect(
      items
        .at(0)
        .find('Count')
        .at(0)
        .text()
    ).toBe('20');

    expect(
      items
        .at(0)
        .find('Count')
        .at(1)
        .text()
    ).toBe('100');

    expect(
      items
        .at(1)
        .find('Count')
        .at(0)
        .text()
    ).toBe('32');

    expect(
      items
        .at(1)
        .find('Count')
        .at(1)
        .text()
    ).toBe('1k');
  });

  it('displays empty state', async function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/',
      body: [],
    });
    const rules_mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rules/',
      body: [],
    });

    wrapper = await createWrapper();

    expect(rules_mock).toHaveBeenCalledTimes(1);

    await tick();
    wrapper.update();

    expect(wrapper.find('PanelItem')).toHaveLength(0);
    expect(wrapper.text()).toContain('No active metric alerts.');
  });

  it('toggles all/open', async function() {
    wrapper = await createWrapper();

    expect(
      wrapper
        .find('ButtonBar')
        .find('Button')
        .at(0)
        .prop('priority')
    ).toBe('primary');

    expect(mock).toHaveBeenCalledTimes(1);

    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/incidents/',
      expect.objectContaining({query: {status: 'open'}})
    );

    wrapper.setProps({location: {query: {status: 'all'}, search: '?status=all`'}});

    expect(
      wrapper
        .find('ButtonBar')
        .find('Button')
        .at(2)
        .prop('priority')
    ).toBe('primary');

    expect(mock).toHaveBeenCalledTimes(2);

    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/incidents/',
      expect.objectContaining({query: expect.objectContaining({status: 'all'})})
    );
  });

  it('disables the new alert button for members', async function() {
    const noAccessOrg = {
      ...organization,
      access: [],
    };

    wrapper = await createWrapper({organization: noAccessOrg});

    const addButton = wrapper.find('button[aria-label="Add Alert Rule"]');
    expect(addButton.props()['aria-disabled']).toBe(true);

    // Enabled with access
    wrapper = await createWrapper();

    // NOTE: A link when not disabled
    const addLink = wrapper.find('a[aria-label="Add Alert Rule"]');
    expect(addLink.props()['aria-disabled']).toBe(false);
  });
});
