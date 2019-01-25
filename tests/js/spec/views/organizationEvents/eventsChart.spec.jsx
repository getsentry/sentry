import React from 'react';

import {EventsChart} from 'app/views/organizationEvents/eventsChart';
import {chart, doZoom, mockZoomRange} from 'app-test/helpers/charts';
import {getLocalDateObject} from 'app/utils/dates';
import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {mount} from 'enzyme';
import {updateParams} from 'app/actionCreators/globalSelection';

jest.mock('app/views/organizationEvents/utils/eventsRequest', () => jest.fn(() => null));

jest.mock('app/actionCreators/globalSelection', () => ({
  updateParams: jest.fn(),
}));

describe('EventsChart', function() {
  const {router, routerContext, org} = initializeOrg();
  let render;
  let wrapper;

  beforeEach(function() {
    mockZoomRange(1543449600000, 1543708800000);
    wrapper = mount(
      <EventsChart
        api={new MockApiClient()}
        location={{query: {}}}
        organization={org}
        project={[]}
        environment={[]}
        period="14d"
        start={null}
        end={null}
        utc={false}
        router={router}
      />,
      routerContext
    );

    // XXX: Note we spy on this AFTER it has already rendered once!
    render = jest.spyOn(wrapper.find('ChartZoom').instance(), 'render');
  });

  it('renders', function() {
    expect(render).toHaveBeenCalledTimes(0);
  });

  it('re-renders if period from props changes', function() {
    wrapper.setProps({period: '7d'});
    wrapper.update();
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('re-renders if query from props changes', function() {
    wrapper.setProps({query: 'newQuery'});
    wrapper.update();
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('re-renders if project from props changes', function() {
    wrapper.setProps({project: [2]});
    wrapper.update();
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('has correct history entries when zooming', function() {
    let newParams;
    const chartZoomInstance = wrapper.find('ChartZoom').instance();

    doZoom(wrapper, chart);
    expect(chartZoomInstance.history).toEqual([
      {
        period: '14d',
        start: null,
        end: null,
      },
    ]);
    expect(chartZoomInstance.currentPeriod.period).toEqual(null);
    expect(chartZoomInstance.currentPeriod.start).toEqual('2018-11-29T00:00:00');
    expect(chartZoomInstance.currentPeriod.end).toEqual('2018-12-02T00:00:00');

    // Zoom again
    mockZoomRange(1543536000000, 1543708800000);
    doZoom(wrapper, chart);
    expect(chartZoomInstance.currentPeriod.period).toEqual(null);
    expect(chartZoomInstance.currentPeriod.start).toEqual('2018-11-30T00:00:00');
    expect(chartZoomInstance.currentPeriod.end).toEqual('2018-12-02T00:00:00');

    expect(chartZoomInstance.history[0]).toEqual({
      period: '14d',
      start: null,
      end: null,
    });
    expect(chartZoomInstance.history[1].start).toEqual('2018-11-29T00:00:00');
    expect(chartZoomInstance.history[1].end).toEqual('2018-12-02T00:00:00');

    // go back in history
    mockZoomRange(null, null);
    doZoom(wrapper, chart);
    expect(chartZoomInstance.currentPeriod.period).toEqual(null);
    expect(chartZoomInstance.currentPeriod.start).toEqual('2018-11-29T00:00:00');
    expect(chartZoomInstance.currentPeriod.end).toEqual('2018-12-02T00:00:00');
    newParams = {
      period: null,
      start: '2018-11-29T00:00:00',
      end: '2018-12-02T00:00:00',
    };
    expect(updateParams).toHaveBeenCalledWith(newParams, router);
    wrapper.setProps({
      period: newParams.period,
      start: getLocalDateObject(newParams.start),
      end: getLocalDateObject(newParams.end),
    });
    wrapper.update();
  });

  it('updates url params when restoring zoom level on chart', function() {
    let newParams;

    doZoom(wrapper, chart);
    // Zoom again
    mockZoomRange(1543536000000, 1543708800000);
    doZoom(wrapper, chart);
    mockZoomRange(1543622400000, 1543708800000);
    doZoom(wrapper, chart);

    const chartZoomInstance = wrapper.find('ChartZoom').instance();
    expect(chartZoomInstance.history).toHaveLength(3);

    // Restore history
    chartZoomInstance.handleZoomRestore();
    chartZoomInstance.handleChartFinished();
    expect(chartZoomInstance.currentPeriod).toEqual({
      period: '14d',
      start: null,
      end: null,
    });
    newParams = {
      period: '14d',
      start: null,
      end: null,
    };
    expect(updateParams).toHaveBeenCalledWith(newParams, router);
    wrapper.setProps({
      period: '14d',
      start: null,
      end: null,
    });
    wrapper.update();

    expect(chartZoomInstance.history).toHaveLength(0);
  });
});
