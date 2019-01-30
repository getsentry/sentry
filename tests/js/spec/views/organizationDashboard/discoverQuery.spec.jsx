import {mount} from 'enzyme';
import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {mockRouterPush} from 'app-test/helpers/mockRouterPush';

import DiscoverQuery from 'app/views/organizationDashboard/discoverQuery';

describe('DiscoverQuery', function() {
  const {organization, router, routerContext} = initializeOrg({
    organization: {
      features: ['sentry10', 'global-views'],
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

  beforeEach(function() {
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

  it('fetches data on mount', async function() {
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

  it('re-renders if props.selection changes', function() {
    renderMock.mockClear();
    wrapper.setProps({selection: {datetime: {period: '7d'}}});
    wrapper.update();

    // Called twice because of fetchData (state.reloading)
    expect(renderMock).toHaveBeenCalledTimes(2);
  });

  it('re-renders if props.org changes', function() {
    renderMock.mockClear();
    wrapper.update();
    expect(renderMock).toHaveBeenCalledTimes(0);

    wrapper.setProps({organization: TestStubs.Organization()});
    wrapper.update();

    // Called twice because of fetchData (state.reloading)
    expect(renderMock).toHaveBeenCalledTimes(2);
  });

  // I think this behavior can go away if necessary in the future
  it('does not re-render if `props.queries` changes', function() {
    renderMock.mockClear();
    wrapper.setProps({queries: []});
    wrapper.update();

    expect(renderMock).toHaveBeenCalledTimes(0);
  });

  it('does not re-render if `props.children` "changes" (e.g. new function instance gets passed every render)', function() {
    renderMock.mockClear();
    let newRender = jest.fn(() => null);
    wrapper.setProps({children: newRender});
    wrapper.update();

    expect(renderMock).toHaveBeenCalledTimes(0);
  });

  it('has the right period and rollup queries when we include previous period', function() {
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
});
