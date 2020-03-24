import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import IncidentsList from 'app/views/alerts/list';

describe('IncidentsList', function() {
  const {routerContext} = initializeOrg();
  let mock;
  let projectMock;
  let wrapper;
  const projects1 = ['a', 'b', 'c'];
  const projects2 = ['c', 'd'];

  const createWrapper = async props => {
    wrapper = mountWithTheme(
      <IncidentsList
        params={{orgId: 'org-slug'}}
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

    projectMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [
        TestStubs.Project({slug: 'a', platform: 'javascript'}),
        TestStubs.Project({slug: 'b'}),
        TestStubs.Project({slug: 'c'}),
        TestStubs.Project({slug: 'd'}),
      ],
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('displays list', async function() {
    wrapper = await createWrapper();

    const items = wrapper.find('IncidentPanelItem');

    expect(items).toHaveLength(2);
    expect(items.at(0).text()).toContain('First incident');
    expect(items.at(1).text()).toContain('Second incident');
    expect(projectMock).toHaveBeenCalledTimes(1);
    expect(projectMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {query: 'slug:a slug:b slug:c slug:d'},
      })
    );
    expect(
      items
        .at(0)
        .find('IdBadge')
        .prop('project')
    ).toMatchObject({
      platform: 'javascript',
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

    wrapper = await createWrapper();
    expect(wrapper.find('PanelItem')).toHaveLength(0);
    expect(wrapper.text()).toContain("You don't have any Metric Alerts yet");
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
});
