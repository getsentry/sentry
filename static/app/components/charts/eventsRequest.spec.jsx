import {mountWithTheme} from 'sentry-test/enzyme';

import {doEventsRequest} from 'sentry/actionCreators/events';
import EventsRequest from 'sentry/components/charts/eventsRequest';

const COUNT_OBJ = {
  count: 123,
};

jest.mock('sentry/actionCreators/events', () => ({
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
      wrapper = mountWithTheme(<EventsRequest {...DEFAULTS}>{mock}</EventsRequest>);
    });

    it('makes requests', function () {
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
      wrapper = mountWithTheme(
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
          previousTimeseriesData: [
            expect.objectContaining({
              seriesName: 'Previous',
              data: [
                expect.objectContaining({
                  name: expect.anything(),
                  value: 400,
                }),
              ],
            }),
          ],

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

    it('expands multiple periods in query if `includePrevious`', async function () {
      doEventsRequest.mockImplementation(() =>
        Promise.resolve({
          'count()': {
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
          'failure_count()': {
            data: [
              [
                new Date(),
                [
                  {...COUNT_OBJ, count: 421},
                  {...COUNT_OBJ, count: 79},
                ],
              ],
              [new Date(), [COUNT_OBJ]],
            ],
          },
        })
      );
      const multiYOptions = {
        yAxis: ['count()', 'failure_count()'],
        previousSeriesNames: ['previous count()', 'previous failure_count()'],
      };
      wrapper = mountWithTheme(
        <EventsRequest {...DEFAULTS} {...multiYOptions} includePrevious>
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
          yAxis: ['count()', 'failure_count()'],
          previousSeriesNames: ['previous count()', 'previous failure_count()'],
          results: [
            expect.objectContaining({
              data: [expect.objectContaining({name: expect.anything(), value: 123})],
              seriesName: 'count()',
            }),
            expect.objectContaining({
              data: [expect.objectContaining({name: expect.anything(), value: 123})],
              seriesName: 'failure_count()',
            }),
          ],
          previousTimeseriesData: [
            expect.objectContaining({
              data: [expect.objectContaining({name: expect.anything(), value: 400})],
              seriesName: 'previous count()',
              stack: 'previous',
            }),
            expect.objectContaining({
              data: [expect.objectContaining({name: expect.anything(), value: 500})],
              seriesName: 'previous failure_count()',
              stack: 'previous',
            }),
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

      wrapper = mountWithTheme(
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

      wrapper = mountWithTheme(
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

      wrapper = mountWithTheme(
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
          previousTimeseriesData: [
            expect.objectContaining({
              seriesName: 'Previous',
              data: [
                expect.objectContaining({
                  name: expect.anything(),
                  value: 400,
                }),
              ],
            }),
          ],

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

      wrapper = mountWithTheme(
        <EventsRequest {...DEFAULTS} yAxis={['apdex()', 'epm()']}>
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

      wrapper = mountWithTheme(
        <EventsRequest {...DEFAULTS} field={['project', 'level']} topEvents={2}>
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

  describe('out of retention', function () {
    beforeEach(function () {
      doEventsRequest.mockClear();
    });

    it('does not make request', function () {
      wrapper = mountWithTheme(
        <EventsRequest {...DEFAULTS} expired>
          {mock}
        </EventsRequest>
      );
      expect(doEventsRequest).not.toHaveBeenCalled();
    });

    it('errors', function () {
      wrapper = mountWithTheme(
        <EventsRequest {...DEFAULTS} expired>
          {mock}
        </EventsRequest>
      );
      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          expired: true,
          errored: true,
        })
      );
    });
  });

  describe('timeframe', function () {
    beforeEach(function () {
      doEventsRequest.mockClear();
    });

    it('passes query timeframe start and end to the child if supplied by timeseriesData', async function () {
      doEventsRequest.mockImplementation(() =>
        Promise.resolve({
          p95: {
            data: [[new Date(), [COUNT_OBJ]]],
            start: 1627402280,
            end: 1627402398,
          },
        })
      );
      wrapper = mountWithTheme(<EventsRequest {...DEFAULTS}>{mock}</EventsRequest>);

      await tick();
      wrapper.update();

      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          timeframe: {
            start: 1627402280000,
            end: 1627402398000,
          },
        })
      );
    });
  });
});
