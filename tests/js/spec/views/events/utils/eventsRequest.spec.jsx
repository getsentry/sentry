import {mount} from 'sentry-test/enzyme';
import React from 'react';

import {doEventsRequest} from 'app/actionCreators/events';
import EventsRequest from 'app/views/events/utils/eventsRequest';

const COUNT_OBJ = {
  count: 123,
};

jest.mock('app/actionCreators/events', () => {
  return {
    doEventsRequest: jest.fn(),
  };
});

describe('EventsRequest', function() {
  const project = TestStubs.Project();
  const organization = TestStubs.Organization();
  const mock = jest.fn(() => null);
  const DEFAULTS = {
    api: {},
    projects: [parseInt(project.id, 10)],
    environments: [],
    period: '24h',
    organization,
    tag: 'release',
    includePrevious: false,
    includeTimeseries: true,
  };

  let wrapper;

  describe('with props changes', function() {
    beforeAll(function() {
      doEventsRequest.mockImplementation(() =>
        Promise.resolve({
          data: [[new Date(), [COUNT_OBJ]]],
        })
      );
      wrapper = mount(<EventsRequest {...DEFAULTS}>{mock}</EventsRequest>);
    });

    it('makes requests', async function() {
      expect(mock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          loading: true,
        })
      );

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          loading: false,
          timeseriesData: [
            {
              seriesName: expect.anything(),
              data: [
                expect.objectContaining({
                  name: expect.any(Number),
                  value: 123,
                }),
              ],
            },
          ],
          originalTimeseriesData: [[expect.anything(), expect.anything()]],
        })
      );

      expect(doEventsRequest).toHaveBeenCalled();
    });

    it('makes a new request if projects prop changes', async function() {
      doEventsRequest.mockClear();

      wrapper.setProps({projects: [123]});
      await tick();
      wrapper.update();
      expect(doEventsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          projects: [123],
        })
      );
    });

    it('makes a new request if environments prop changes', async function() {
      doEventsRequest.mockClear();

      wrapper.setProps({environments: ['dev']});
      await tick();
      wrapper.update();
      expect(doEventsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          environments: ['dev'],
        })
      );
    });

    it('makes a new request if period prop changes', async function() {
      doEventsRequest.mockClear();

      wrapper.setProps({period: '7d'});
      await tick();
      wrapper.update();
      expect(doEventsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          period: '7d',
        })
      );
    });
  });

  describe('transforms', function() {
    beforeEach(function() {
      doEventsRequest.mockClear();
    });

    it('expands period in query if `includePrevious`', async function() {
      doEventsRequest.mockImplementation(() =>
        Promise.resolve({
          data: [
            [new Date(), [{...COUNT_OBJ, count: 321}, {...COUNT_OBJ, count: 79}]],
            [new Date(), [COUNT_OBJ]],
          ],
        })
      );
      wrapper = mount(
        <EventsRequest {...DEFAULTS} includePrevious>
          {mock}
        </EventsRequest>
      );

      await tick();
      wrapper.update();

      // actionCreator handles expanding the period when calling the API
      expect(doEventsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          period: '24h',
        })
      );

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          loading: false,
          allTimeseriesData: [
            [
              expect.anything(),
              [
                expect.objectContaining({count: 321}),
                expect.objectContaining({count: 79}),
              ],
            ],
            [expect.anything(), [expect.objectContaining({count: 123})]],
          ],
          timeseriesData: [
            {
              seriesName: expect.anything(),
              data: [
                expect.objectContaining({
                  name: expect.anything(),
                  value: 123,
                }),
              ],
            },
          ],
          previousTimeseriesData: {
            seriesName: 'Previous Period',
            data: [
              expect.objectContaining({
                name: expect.anything(),
                value: 400,
              }),
            ],
          },

          originalTimeseriesData: [
            [expect.anything(), [expect.objectContaining({count: 123})]],
          ],

          originalPreviousTimeseriesData: [
            [
              expect.anything(),
              [
                expect.objectContaining({count: 321}),
                expect.objectContaining({count: 79}),
              ],
            ],
          ],
        })
      );
    });

    it('aggregates counts per timestamp only when `includeTimeAggregation` prop is true', async function() {
      doEventsRequest.mockImplementation(() =>
        Promise.resolve({
          data: [[new Date(), [COUNT_OBJ, {...COUNT_OBJ, count: 100}]]],
        })
      );

      wrapper = mount(
        <EventsRequest {...DEFAULTS} includeTimeseries>
          {mock}
        </EventsRequest>
      );

      await tick();
      wrapper.update();

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          timeAggregatedData: {},
        })
      );

      wrapper.setProps({
        includeTimeAggregation: true,
        timeAggregationSeriesName: 'aggregated series',
      });
      await tick();
      wrapper.update();

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          timeAggregatedData: {
            seriesName: 'aggregated series',
            data: [{name: expect.anything(), value: 223}],
          },
        })
      );
    });

    it('aggregates all counts per timestamp when category name identical', async function() {
      doEventsRequest.mockImplementation(() =>
        Promise.resolve({
          data: [[new Date(), [COUNT_OBJ, {...COUNT_OBJ, count: 100}]]],
        })
      );

      wrapper = mount(
        <EventsRequest {...DEFAULTS} includeTimeseries>
          {mock}
        </EventsRequest>
      );

      await tick();
      wrapper.update();

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          timeAggregatedData: {},
        })
      );

      wrapper.setProps({
        includeTimeAggregation: true,
        timeAggregationSeriesName: 'aggregated series',
      });
      await tick();
      wrapper.update();

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          timeAggregatedData: {
            seriesName: 'aggregated series',
            data: [{name: expect.anything(), value: 223}],
          },
        })
      );
    });
  });
});
