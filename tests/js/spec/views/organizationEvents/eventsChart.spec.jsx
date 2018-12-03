import React from 'react';

import {EventsChart} from 'app/views/organizationEvents/eventsChart';
import {getLocalDateObject} from 'app/utils/dates';
import {mount} from 'enzyme';

jest.mock('app/views/organizationEvents/utils/eventsRequest', () => ({
  EventsRequestWithParams: jest.fn(() => null),
}));

describe('EventsChart', function() {
  let wrapper;
  let org = TestStubs.Organization();
  let updateParams = jest.fn();
  let render = jest.spyOn(EventsChart.prototype, 'render');
  let data = [
    [1543276800000, 0],
    [1543363200000, 0],
    [1543449600000, 36],
    [1543536000000, 40],
    [1543622400000, 0],
    [1543708800000, 17],
    [1543795200000, 104],
    [1543881600000, 13],
  ];
  let model = {
    xAxis: [
      {
        rangeStart: 2,
        rangeEnd: 5,
      },
    ],
    series: [
      {
        data,
      },
    ],
  };
  let chart = {
    getModel: jest.fn(() => ({option: model})),
  };

  const mockZoomRange = (rangeStart, rangeEnd) => {
    chart.getModel.mockImplementation(() => ({
      option: {
        ...model,
        xAxis: [
          {
            rangeStart,
            rangeEnd,
          },
        ],
      },
    }));
  };

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

  it('re-renders if project from props changes', function() {
    wrapper.setProps({project: [2]});
    wrapper.update();
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('does not re-render if zoomed', function() {
    wrapper.instance().handleDataZoom({}, chart);
    let newParams = {
      statsPeriod: null,
      start: '2018-11-29T00:00:00',
      end: '2018-12-02T23:59:59',
    };
    expect(updateParams).toHaveBeenCalledWith(newParams);
    wrapper.setProps({
      period: newParams.statsPeriod,
      start: getLocalDateObject(newParams.start),
      end: getLocalDateObject(newParams.end),
    });
    wrapper.update();

    expect(render).toHaveBeenCalledTimes(1);
  });

  it('has correct history entries when zooming', function() {
    let newParams;

    wrapper.instance().handleDataZoom({}, chart);
    expect(wrapper.instance().history).toEqual([
      {
        period: '14d',
        start: null,
        end: null,
      },
    ]);
    expect(wrapper.state('period')).toEqual(null);
    expect(wrapper.state('start')).toEqual('2018-11-29T00:00:00');
    expect(wrapper.state('end')).toEqual('2018-12-02T23:59:59');

    // Zoom again
    mockZoomRange(3, 5);
    wrapper.instance().handleDataZoom({}, chart);
    expect(wrapper.state('period')).toEqual(null);
    expect(wrapper.state('start')).toEqual('2018-11-30T00:00:00');
    expect(wrapper.state('end')).toEqual('2018-12-02T23:59:59');
    expect(wrapper.instance().history[0]).toEqual({
      period: '14d',
      start: null,
      end: null,
    });

    expect(wrapper.instance().history[1].start).toEqual('2018-11-29T00:00:00');
    expect(wrapper.instance().history[1].end).toEqual('2018-12-02T23:59:59');

    // go back in history
    mockZoomRange(null, null);
    wrapper.instance().handleDataZoom({}, chart);
    expect(wrapper.state('period')).toEqual(null);
    expect(wrapper.state('start')).toEqual('2018-11-29T00:00:00');
    expect(wrapper.state('end')).toEqual('2018-12-02T23:59:59');
    newParams = {
      statsPeriod: null,
      start: '2018-11-29T00:00:00',
      end: '2018-12-02T23:59:59',
    };
    expect(updateParams).toHaveBeenCalledWith(newParams);
    wrapper.setProps({
      period: newParams.statsPeriod,
      start: getLocalDateObject(newParams.start),
      end: getLocalDateObject(newParams.end),
    });
    wrapper.update();

    expect(render).toHaveBeenCalledTimes(1);
  });

  it('updates url params when restoring zoom level on chart', function() {
    let newParams;

    wrapper.instance().handleDataZoom({}, chart);
    // Zoom again
    mockZoomRange(3, 5);
    wrapper.instance().handleDataZoom({}, chart);
    mockZoomRange(4, 5);
    wrapper.instance().handleDataZoom({}, chart);

    expect(wrapper.instance().history).toHaveLength(3);

    // Restore history
    wrapper.instance().handleZoomRestore();
    expect(wrapper.state()).toEqual({
      period: '14d',
      start: null,
      end: null,
    });
    newParams = {
      statsPeriod: '14d',
      start: null,
      end: null,
    };
    expect(updateParams).toHaveBeenCalledWith(newParams);
    wrapper.setProps(newParams);
    wrapper.update();

    expect(wrapper.instance().history).toHaveLength(0);
    expect(render).toHaveBeenCalledTimes(1);
  });
});
