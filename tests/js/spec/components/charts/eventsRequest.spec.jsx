import React from 'react';

import {mount} from 'sentry-test/enzyme';

import EventsRequest from 'app/components/charts/eventsRequest';
import {doEventsRequest} from 'app/actionCreators/events';

const COUNT_OBJ = {
  count: 123,
};

jest.mock('app/actionCreators/events', () => ({
  doEventsRequest: jest.fn(),
}));

describe('EventsRequest', function () {
  const project = TestStubs.Project();
  const organization = TestStubs.Organization();
  const mock = jest.fn(() => null);
  const DEFAULTS = {
    api: new MockApiClient(),
    projects: [parseInt(project.id, 10)],
    environments: [],
    period: '24h',
    organization,
    tag: 'release',
    includePrevious: false,
    includeTimeseries: true,
  };

  let wrapper;

  describe('with props changes', function () {
    beforeAll(function () {
      doEventsRequest.mockImplementation(() =>
        Promise.resolve({
          data: [[new Date(), [COUNT_OBJ]]],
        })
      );
      wrapper = mount(<EventsRequest {...DEFAULTS}>{mock}</EventsRequest>);
    });

    it('makes requests', async function () {
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

    it('makes a new request if projects prop changes', async function () {
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

    it('makes a new request if environments prop changes', async function () {
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

    it('makes a new request if period prop changes', async function () {
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

  describe('transforms', function () {
    beforeEach(function () {
      doEventsRequest.mockClear();
    });

    it('expands period in query if `includePrevious`', async function () {
      doEventsRequest.mockImplementation(() =>
        Promise.resolve({
          data: [
            [
              new Date(),
              [
                {...COUNT_OBJ, count: 321},
                {...COUNT_OBJ, count: 79},
              ],
            ],
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
            seriesName: 'Previous',
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

    it('aggregates counts per timestamp only when `includeTimeAggregation` prop is true', async function () {
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

    it('aggregates all counts per timestamp when category name identical', async function () {
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

  describe('yAxis', function () {
    beforeEach(function () {
      doEventsRequest.mockClear();
    });

    it('supports yAxis', async function () {
      doEventsRequest.mockImplementation(() =>
        Promise.resolve({
          data: [
            [
              new Date(),
              [
                {...COUNT_OBJ, count: 321},
                {...COUNT_OBJ, count: 79},
              ],
            ],
            [new Date(), [COUNT_OBJ]],
          ],
        })
      );

      wrapper = mount(
        <EventsRequest {...DEFAULTS} includePrevious yAxis="apdex()">
          {mock}
        </EventsRequest>
      );

      await tick();
      wrapper.update();

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
            seriesName: 'Previous',
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

    it('supports multiple yAxis', async function () {
      doEventsRequest.mockImplementation(() =>
        Promise.resolve({
          'epm()': {
            data: [
              [
                new Date(),
                [
                  {...COUNT_OBJ, count: 321},
                  {...COUNT_OBJ, count: 79},
                ],
              ],
              [new Date(), [COUNT_OBJ]],
            ],
          },
          'apdex()': {
            data: [
              [
                new Date(),
                [
                  {...COUNT_OBJ, count: 321},
                  {...COUNT_OBJ, count: 79},
                ],
              ],
              [new Date(), [COUNT_OBJ]],
            ],
          },
        })
      );

      wrapper = mount(
        <EventsRequest {...DEFAULTS} includePrevious yAxis={['apdex()', 'epm()']}>
          {mock}
        </EventsRequest>
      );

      await tick();
      wrapper.update();

      const generateExpected = name => {
        return {
          seriesName: name,
          data: [
            {name: expect.anything(), value: 400},
            {name: expect.anything(), value: 123},
          ],
        };
      };

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          loading: false,

          results: [generateExpected('epm()'), generateExpected('apdex()')],
        })
      );
    });
  });

  describe('topEvents', function () {
    beforeEach(function () {
      doEventsRequest.mockClear();
    });

    it('supports topEvents parameter', async function () {
      doEventsRequest.mockImplementation(() =>
        Promise.resolve({
          'project1,error': {
            data: [
              [
                new Date(),
                [
                  {...COUNT_OBJ, count: 321},
                  {...COUNT_OBJ, count: 79},
                ],
              ],
              [new Date(), [COUNT_OBJ]],
            ],
          },
          'project1,warning': {
            data: [
              [
                new Date(),
                [
                  {...COUNT_OBJ, count: 321},
                  {...COUNT_OBJ, count: 79},
                ],
              ],
              [new Date(), [COUNT_OBJ]],
            ],
          },
        })
      );

      wrapper = mount(
        <EventsRequest
          {...DEFAULTS}
          includePrevious
          field={['project', 'level']}
          topEvents={2}
        >
          {mock}
        </EventsRequest>
      );

      await tick();
      wrapper.update();

      const generateExpected = name => {
        return {
          seriesName: name,
          data: [
            {name: expect.anything(), value: 400},
            {name: expect.anything(), value: 123},
          ],
        };
      };

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          loading: false,

          results: [
            generateExpected('project1,error'),
            generateExpected('project1,warning'),
          ],
        })
      );
    });
  });
});
