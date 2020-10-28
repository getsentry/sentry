import React from 'react';

import {mount} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {mockRouterPush} from 'sentry-test/mockRouterPush';

import DiscoverQuery from 'app/views/dashboards/discoverQuery';
import ProjectsStore from 'app/stores/projectsStore';

describe('DiscoverQuery', function () {
  const {organization, router, routerContext} = initializeOrg({
    organization: {
      features: ['global-views'],
    },
    router: {
      location: {
        pathname: '/organizations/org-slug/dashboard/?statsPeriod=14d&utc=true',
        query: {},
      },
    },
  });
  const widget = TestStubs.Widget();

  let wrapper;
  let discoverMock;
  const renderMock = jest.fn(() => null);

  beforeEach(async function () {
    ProjectsStore.loadInitialData([TestStubs.Project()]);
    await tick();

    renderMock.mockClear();
    router.push.mockRestore();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/environments/`,
      body: TestStubs.Environments(),
    });
    discoverMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/query/',
      method: 'POST',
      body: {
        data: [],
        meta: [],
        timing: {},
      },
    });
    wrapper = mount(
      <DiscoverQuery
        widget={widget}
        selection={{datetime: {period: '14d'}}}
        organization={organization}
        queries={widget.queries.discover}
      >
        {renderMock}
      </DiscoverQuery>,
      routerContext
    );
    mockRouterPush(wrapper, router);
  });

  it('fetches data on mount', async function () {
    expect(discoverMock).toHaveBeenCalledTimes(2);
    await tick();
    wrapper.update();

    // First call is on mount which then fetches data
    // Second call is when reloading = false
    // Third call should have results
    expect(renderMock).toHaveBeenCalledTimes(3);
    expect(renderMock).toHaveBeenCalledWith(
      expect.objectContaining({results: null, reloading: null})
    );
    expect(renderMock).toHaveBeenCalledWith(
      expect.objectContaining({results: null, reloading: true})
    );
    expect(renderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        results: [
          {
            data: [],
            meta: [],
            timing: {},
          },
          {
            data: [],
            meta: [],
            timing: {},
          },
        ],
        reloading: false,
      })
    );
  });

  it('re-renders if props.selection changes', function () {
    renderMock.mockClear();
    wrapper.setProps({selection: {datetime: {period: '7d'}}});
    wrapper.update();

    // Called twice because of fetchData (state.reloading)
    expect(renderMock).toHaveBeenCalledTimes(2);
  });

  it('re-renders if props.org changes', function () {
    renderMock.mockClear();
    wrapper.update();
    expect(renderMock).toHaveBeenCalledTimes(0);

    wrapper.setProps({
      organization: TestStubs.Organization({projects: [TestStubs.Project()]}),
    });
    wrapper.update();

    // Called twice because of fetchData (state.reloading)
    expect(renderMock).toHaveBeenCalledTimes(2);
  });

  // I think this behavior can go away if necessary in the future
  it('does not re-render if `props.queries` changes', function () {
    renderMock.mockClear();
    wrapper.setProps({queries: []});
    wrapper.update();

    expect(renderMock).toHaveBeenCalledTimes(0);
  });

  it('does not re-render if `props.children` "changes" (e.g. new function instance gets passed every render)', function () {
    renderMock.mockClear();
    const newRender = jest.fn(() => null);
    wrapper.setProps({children: newRender});
    wrapper.update();

    expect(renderMock).toHaveBeenCalledTimes(0);
  });

  it('has the right period and rollup queries when we include previous period', function () {
    renderMock.mockClear();
    wrapper = mount(
      <DiscoverQuery
        selection={{datetime: {period: '12h'}}}
        organization={organization}
        queries={widget.queries.discover}
        includePreviousPeriod
        compareToPeriod={{statsPeriodStart: '25h', statsPeriodEnd: '13h'}}
      >
        {renderMock}
      </DiscoverQuery>,
      routerContext
    );
    mockRouterPush(wrapper, router);

    expect(renderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: [
          expect.objectContaining({range: '24h'}),
          expect.objectContaining({range: '24h'}),
        ],
      })
    );
  });

  it('queries using "recentReleases" constraint', function () {
    const release = TestStubs.Release();
    renderMock.mockClear();
    wrapper = mount(
      <DiscoverQuery
        selection={{datetime: {period: '12h'}}}
        organization={organization}
        releases={[release]}
        queries={[
          {
            name: 'Events by Release',
            fields: ['release'],
            constraints: ['recentReleases'],
            conditions: [],
            aggregations: [['count()', null, 'Events']],
            limit: 5000,

            orderby: '-time',
            groupby: ['time', 'release'],
            rollup: 86400,
          },
        ]}
      >
        {renderMock}
      </DiscoverQuery>,
      routerContext
    );

    mockRouterPush(wrapper, router);

    expect(discoverMock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/discover/query/',
      expect.objectContaining({
        data: expect.objectContaining({
          aggregations: [['count()', null, 'Events']],
          conditionFields: [
            [
              'if',
              [
                ['in', ['release', 'tuple', [`'${release.version}'`]]],
                'release',
                "'other'",
              ],
              'release',
            ],
          ],
          fields: [],
          groupby: ['time', 'release'],
          conditions: [],
          limit: 5000,
          name: 'Events by Release',
          orderby: '-time',
        }),
        method: 'POST',
      })
    );
  });
});
