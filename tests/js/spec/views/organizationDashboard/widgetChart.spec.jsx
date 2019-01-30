import {mount} from 'enzyme';
import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';

import WidgetChart from 'app/views/organizationDashboard/widgetChart';

describe('WidgetChart', function() {
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

  let wrapper;
  const renderMock = jest.fn(() => null);

  const TIME_QUERY = {
    fields: [],
    aggregations: [['count()', '', 'count']],
    orderby: '-time',
    groupby: ['time'],
    limit: 1000,
  };

  const MAP_QUERY = {
    fields: ['geo.country_code'],
    conditions: [['geo.country_code', 'IS NOT NULL', null]],
    aggregations: [['count()', null, 'count']],
    limit: 10,

    orderby: '-count',
    groupby: ['geo.country_code'],
  };

  beforeEach(function() {
    renderMock.mockClear();
    router.push.mockRestore();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/environments/`,
      body: TestStubs.Environments(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/query/',
      method: 'POST',
      body: {
        data: [],
        meta: [],
        timing: {},
      },
    });
  });

  it('renders zoomable time chart', async function() {
    wrapper = mount(
      <WidgetChart
        widget={TestStubs.Widget({
          discover: [TIME_QUERY],
        })}
        selection={{datetime: {period: '14d'}}}
        organization={organization}
        results={[{data: [{time: 1, count: 1}]}]}
      />,
      routerContext
    );

    expect(wrapper.find('LineChart')).toHaveLength(1);
    expect(wrapper.find('ChartZoom')).toHaveLength(1);
  });

  it('renders time chart with series', async function() {
    wrapper = mount(
      <WidgetChart
        widget={TestStubs.Widget(
          {
            discover: [TIME_QUERY],
          },
          {
            includeReleases: true,
          }
        )}
        selection={{datetime: {period: '14d'}}}
        organization={organization}
        results={[{data: [{time: 1, count: 1}]}]}
      />,
      routerContext
    );

    expect(wrapper.find('ReleaseSeries')).toHaveLength(1);
  });

  it('renders non-zoomable non-time chart', async function() {
    wrapper = mount(
      <WidgetChart
        widget={TestStubs.Widget(
          {
            discover: [MAP_QUERY],
          },
          {
            type: 'world-map',
          }
        )}
        selection={{datetime: {period: '14d'}}}
        organization={organization}
        results={[{data: [{time: 1, count: 1}]}]}
      />,
      routerContext
    );

    expect(wrapper.find('WorldMapChart')).toHaveLength(1);
    expect(wrapper.find('ChartZoom')).toHaveLength(0);
  });

  it('update only if data is not reloading and data has changed', async function() {
    wrapper = mount(
      <WidgetChart
        widget={TestStubs.Widget(
          {
            discover: [MAP_QUERY],
          },
          {
            type: 'world-map',
          }
        )}
        selection={{datetime: {period: '14d'}}}
        organization={organization}
        results={[{data: [{time: 1, count: 1}]}]}
      />,
      routerContext
    );

    const renderSpy = jest.spyOn(wrapper.find('WorldMapChart').instance(), 'render');

    wrapper.setProps({reloading: true});
    wrapper.update();
    expect(renderSpy).toHaveBeenCalledTimes(0);

    wrapper.setProps({reloading: false, results: [{data: [{time: 1, count: 2}]}]});
    wrapper.update();
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });
});
