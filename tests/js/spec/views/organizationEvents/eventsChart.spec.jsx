import {mount} from 'enzyme';
import React from 'react';

import {EventsChart} from 'app/views/organizationEvents/eventsChart';
import {getLocalDateObject} from 'app/utils/dates';
import {chart, doZoom, mockZoomRange} from '../../../helpers/charts';

jest.mock('app/views/organizationEvents/utils/eventsRequest', () => jest.fn(() => null));

describe('EventsChart', function() {
  let wrapper;
  let org = TestStubs.Organization();
  let updateParams = jest.fn();
  let render = jest.spyOn(EventsChart.prototype, 'render');

  beforeEach(function() {
    render.mockClear();
    mockZoomRange(2, 5);
    wrapper = mount(
      <EventsChart
        api={MockApiClient}
        location={{query: {}}}
        organization={org}
        project={[]}
        environment={[]}
        actions={{updateParams}}
        period="14d"
        start={null}
        end={null}
        utc={false}
      />
    );
  });

  it('renders', function() {
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('re-renders if period from props changes', function() {
    wrapper.setProps({period: '7d'});
    wrapper.update();
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('re-renders if query from props changes', function() {
    wrapper.setProps({query: 'newQuery'});
    wrapper.update();
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('re-renders if project from props changes', function() {
    wrapper.setProps({project: [2]});
    wrapper.update();
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('does not re-render if zoomed', function() {
    doZoom(wrapper, chart);
    let newParams = {
      statsPeriod: null,
      start: '2018-11-29T00:00:00',
      end: '2018-12-02T00:00:00',
      zoom: '1',
    };
    expect(updateParams).toHaveBeenCalledWith(newParams);
    wrapper.setProps({
      period: newParams.statsPeriod,
      start: getLocalDateObject(newParams.start),
      end: getLocalDateObject(newParams.end),
      zoom: '1',
    });
    wrapper.update();

    expect(render).toHaveBeenCalledTimes(1);
  });

  it('has correct history entries when zooming', function() {
    let newParams;

    doZoom(wrapper, chart);
    expect(wrapper.instance().history).toEqual([
      {
        period: '14d',
        start: null,
        end: null,
      },
    ]);
    expect(wrapper.instance().currentPeriod.period).toEqual(null);
    expect(wrapper.instance().currentPeriod.start).toEqual('2018-11-29T00:00:00');
    expect(wrapper.instance().currentPeriod.end).toEqual('2018-12-02T00:00:00');

    // Zoom again
    mockZoomRange(3, 5);
    doZoom(wrapper, chart);
    expect(wrapper.instance().currentPeriod.period).toEqual(null);
    expect(wrapper.instance().currentPeriod.start).toEqual('2018-11-30T00:00:00');
    expect(wrapper.instance().currentPeriod.end).toEqual('2018-12-02T00:00:00');

    expect(wrapper.instance().history[0]).toEqual({
      period: '14d',
      start: null,
      end: null,
    });
    expect(wrapper.instance().history[1].start).toEqual('2018-11-29T00:00:00');
    expect(wrapper.instance().history[1].end).toEqual('2018-12-02T00:00:00');

    // go back in history
    mockZoomRange(null, null);
    doZoom(wrapper, chart);
    expect(wrapper.instance().currentPeriod.period).toEqual(null);
    expect(wrapper.instance().currentPeriod.start).toEqual('2018-11-29T00:00:00');
    expect(wrapper.instance().currentPeriod.end).toEqual('2018-12-02T00:00:00');
    newParams = {
      statsPeriod: null,
      start: '2018-11-29T00:00:00',
      end: '2018-12-02T00:00:00',
      zoom: '1',
    };
    expect(updateParams).toHaveBeenCalledWith(newParams);
    wrapper.setProps({
      period: newParams.statsPeriod,
      start: getLocalDateObject(newParams.start),
      end: getLocalDateObject(newParams.end),
      zoom: '1',
    });
    wrapper.update();

    expect(render).toHaveBeenCalledTimes(1);
  });

  it('updates url params when restoring zoom level on chart', function() {
    let newParams;

    doZoom(wrapper, chart);
    // Zoom again
    mockZoomRange(3, 5);
    doZoom(wrapper, chart);
    mockZoomRange(4, 5);
    doZoom(wrapper, chart);

    expect(wrapper.instance().history).toHaveLength(3);

    // Restore history
    wrapper.instance().handleZoomRestore();
    wrapper.instance().handleChartFinished();
    expect(wrapper.instance().currentPeriod).toEqual({
      period: '14d',
      start: null,
      end: null,
    });
    newParams = {
      statsPeriod: '14d',
      start: null,
      end: null,
      zoom: '1',
    };
    expect(updateParams).toHaveBeenCalledWith(newParams);
    wrapper.setProps(newParams);
    wrapper.update();

    expect(wrapper.instance().history).toHaveLength(0);
    expect(render).toHaveBeenCalledTimes(1);
  });
});
