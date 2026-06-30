import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {doEventsRequest} from 'sentry/actionCreators/events';
import type {EventsRequestProps} from 'sentry/components/charts/eventsRequest';
import {EventsRequest} from 'sentry/components/charts/eventsRequest';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';

const COUNT_OBJ = {
  count: 123,
};

jest.mock('sentry/actionCreators/events', () => ({
  doEventsRequest: jest.fn(),
}));

describe('EventsRequest', () => {
  const organization = OrganizationFixture();
  const mock = jest.fn(() => null);

  const DEFAULTS: EventsRequestProps = {
    api: new MockApiClient(),
    period: '24h',
    organization,
    includePrevious: false,
    interval: '24h',
    limit: 30,
    query: '',
    children: () => null,
    partial: false,
    includeAllArgs: false,
    includeTransformedData: true,
  };

  describe('with props changes', () => {
    beforeAll(() => {
      jest.mocked(doEventsRequest).mockImplementation(() =>
        Promise.resolve({
          data: [[0, [COUNT_OBJ]]],
        } as EventsStats)
      );
    });

    it.isKnownFlake('makes requests', async () => {
      render(<EventsRequest {...DEFAULTS}>{mock}</EventsRequest>);
      expect(mock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          loading: true,
        })
      );

      await waitFor(() =>
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
        )
      );

      expect(doEventsRequest).toHaveBeenCalled();
    });

    it('makes a new request if projects prop changes', async () => {
      const {rerender} = render(<EventsRequest {...DEFAULTS}>{mock}</EventsRequest>);
      jest.mocked(doEventsRequest).mockClear();

      rerender(
        <EventsRequest {...DEFAULTS} project={[123]}>
          {mock}
        </EventsRequest>
      );
      await waitFor(() => expect(doEventsRequest).toHaveBeenCalledTimes(1));
      expect(doEventsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          project: [123],
        })
      );
    });

    it('makes a new request if environments prop changes', async () => {
      const {rerender} = render(<EventsRequest {...DEFAULTS}>{mock}</EventsRequest>);
      jest.mocked(doEventsRequest).mockClear();

      rerender(
        <EventsRequest {...DEFAULTS} environment={['dev']}>
          {mock}
        </EventsRequest>
      );
      await waitFor(() => expect(doEventsRequest).toHaveBeenCalledTimes(1));
      expect(doEventsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          environment: ['dev'],
        })
      );
    });

    it('makes a new request if period prop changes', async () => {
      const {rerender} = render(<EventsRequest {...DEFAULTS}>{mock}</EventsRequest>);
      jest.mocked(doEventsRequest).mockClear();

      rerender(
        <EventsRequest {...DEFAULTS} period="7d">
          {mock}
        </EventsRequest>
      );

      await waitFor(() => expect(doEventsRequest).toHaveBeenCalledTimes(1));
      expect(doEventsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          period: '7d',
        })
      );
    });
  });

  describe('transforms', () => {
    beforeEach(() => {
      jest.mocked(doEventsRequest).mockClear();
    });

    it('expands period in query if `includePrevious`', async () => {
      jest.mocked(doEventsRequest).mockImplementation(() =>
        Promise.resolve({
          data: [
            [
              0,
              [
                {...COUNT_OBJ, count: 321},
                {...COUNT_OBJ, count: 79},
              ],
            ],
            [0, [COUNT_OBJ]],
          ],
        } as EventsStats)
      );
      render(
        <EventsRequest {...DEFAULTS} includePrevious>
          {mock}
        </EventsRequest>
      );

      // actionCreator handles expanding the period when calling the API
      expect(doEventsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          period: '24h',
        })
      );

      await waitFor(() =>
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
        )
      );
    });

    it('expands multiple periods in query if `includePrevious`', async () => {
      jest.mocked(doEventsRequest).mockImplementation(() =>
        Promise.resolve({
          'count()': {
            data: [
              [
                0,
                [
                  {...COUNT_OBJ, count: 321},
                  {...COUNT_OBJ, count: 79},
                ],
              ],
              [0, [COUNT_OBJ]],
            ],
          },
          'failure_count()': {
            data: [
              [
                0,
                [
                  {...COUNT_OBJ, count: 421},
                  {...COUNT_OBJ, count: 79},
                ],
              ],
              [0, [COUNT_OBJ]],
            ],
          },
        } as MultiSeriesEventsStats)
      );
      const multiYOptions = {
        yAxis: ['count()', 'failure_count()'],
        previousSeriesNames: ['previous count()', 'previous failure_count()'],
      };
      render(
        <EventsRequest {...DEFAULTS} {...multiYOptions} includePrevious>
          {mock}
        </EventsRequest>
      );

      // actionCreator handles expanding the period when calling the API
      expect(doEventsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          period: '24h',
        })
      );

      await waitFor(() =>
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
        )
      );
    });

    it('aggregates counts per timestamp only when `includeTimeAggregation` prop is true', async () => {
      jest.mocked(doEventsRequest).mockImplementation(() =>
        Promise.resolve({
          data: [[0, [COUNT_OBJ, {...COUNT_OBJ, count: 100}]]],
        } as EventsStats)
      );

      const {rerender} = render(<EventsRequest {...DEFAULTS}>{mock}</EventsRequest>);

      await waitFor(() =>
        expect(mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            timeAggregatedData: {},
          })
        )
      );

      rerender(
        <EventsRequest
          {...DEFAULTS}
          includeTimeAggregation
          timeAggregationSeriesName="aggregated series"
        >
          {mock}
        </EventsRequest>
      );

      await waitFor(() =>
        expect(mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            timeAggregatedData: {
              seriesName: 'aggregated series',
              data: [{name: expect.anything(), value: 223}],
            },
          })
        )
      );
    });

    it('aggregates all counts per timestamp when category name identical', async () => {
      jest.mocked(doEventsRequest).mockImplementation(() =>
        Promise.resolve({
          data: [[0, [COUNT_OBJ, {...COUNT_OBJ, count: 100}]]],
        } as EventsStats)
      );

      const {rerender} = render(<EventsRequest {...DEFAULTS}>{mock}</EventsRequest>);

      await waitFor(() =>
        expect(mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            timeAggregatedData: {},
          })
        )
      );

      rerender(
        <EventsRequest
          {...DEFAULTS}
          includeTimeAggregation
          timeAggregationSeriesName="aggregated series"
        >
          {mock}
        </EventsRequest>
      );

      await waitFor(() =>
        expect(mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            timeAggregatedData: {
              seriesName: 'aggregated series',
              data: [{name: expect.anything(), value: 223}],
            },
          })
        )
      );
    });
  });

  describe('yAxis', () => {
    beforeEach(() => {
      jest.mocked(doEventsRequest).mockClear();
    });

    it('supports yAxis', async () => {
      jest.mocked(doEventsRequest).mockImplementation(() =>
        Promise.resolve({
          data: [
            [
              0,
              [
                {...COUNT_OBJ, count: 321},
                {...COUNT_OBJ, count: 79},
              ],
            ],
            [0, [COUNT_OBJ]],
          ],
        } as EventsStats)
      );

      render(
        <EventsRequest {...DEFAULTS} includePrevious yAxis="apdex()">
          {mock}
        </EventsRequest>
      );

      await waitFor(() =>
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
        )
      );
    });

    it('supports multiple yAxis', async () => {
      jest.mocked(doEventsRequest).mockImplementation(() =>
        Promise.resolve({
          'epm()': {
            data: [
              [
                0,
                [
                  {...COUNT_OBJ, count: 321},
                  {...COUNT_OBJ, count: 79},
                ],
              ],
              [0, [COUNT_OBJ]],
            ],
          },
          'apdex()': {
            data: [
              [
                0,
                [
                  {...COUNT_OBJ, count: 321},
                  {...COUNT_OBJ, count: 79},
                ],
              ],
              [0, [COUNT_OBJ]],
            ],
          },
        } as MultiSeriesEventsStats)
      );

      render(
        <EventsRequest {...DEFAULTS} yAxis={['apdex()', 'epm()']}>
          {mock}
        </EventsRequest>
      );

      const generateExpected = (name: any) => {
        return {
          seriesName: name,
          data: [
            {name: expect.anything(), value: 400},
            {name: expect.anything(), value: 123},
          ],
        };
      };

      await waitFor(() =>
        expect(mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            loading: false,

            results: [generateExpected('epm()'), generateExpected('apdex()')],
          })
        )
      );
    });
  });

  describe('topEvents', () => {
    beforeEach(() => {
      jest.mocked(doEventsRequest).mockClear();
    });

    it('supports topEvents parameter', async () => {
      jest.mocked(doEventsRequest).mockImplementation(() =>
        Promise.resolve({
          'project1,error': {
            data: [
              [
                0,
                [
                  {...COUNT_OBJ, count: 321},
                  {...COUNT_OBJ, count: 79},
                ],
              ],
              [0, [COUNT_OBJ]],
            ],
          },
          'project1,warning': {
            data: [
              [
                0,
                [
                  {...COUNT_OBJ, count: 321},
                  {...COUNT_OBJ, count: 79},
                ],
              ],
              [0, [COUNT_OBJ]],
            ],
          },
        } as MultiSeriesEventsStats)
      );

      render(
        <EventsRequest {...DEFAULTS} field={['project', 'level']} topEvents={2}>
          {mock}
        </EventsRequest>
      );

      const generateExpected = (name: any) => {
        return {
          seriesName: name,
          data: [
            {name: expect.anything(), value: 400},
            {name: expect.anything(), value: 123},
          ],
        };
      };

      await waitFor(() =>
        expect(mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            loading: false,

            results: [
              generateExpected('project1,error'),
              generateExpected('project1,warning'),
            ],
          })
        )
      );
    });
  });

  describe('out of retention', () => {
    beforeEach(() => {
      jest.mocked(doEventsRequest).mockClear();
    });

    it('does not make request', () => {
      render(
        <EventsRequest {...DEFAULTS} expired>
          {mock}
        </EventsRequest>
      );
      expect(doEventsRequest).not.toHaveBeenCalled();
    });

    it('errors', () => {
      render(
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

  describe('timeframe', () => {
    beforeEach(() => {
      jest.mocked(doEventsRequest).mockClear();
    });

    it('passes query timeframe start and end to the child if supplied by timeseriesData', async () => {
      jest.mocked(doEventsRequest).mockImplementation(() =>
        Promise.resolve({
          p95: {
            data: [[0, [COUNT_OBJ]]],
            start: 1627402280,
            end: 1627402398,
          },
        } as MultiSeriesEventsStats)
      );
      render(<EventsRequest {...DEFAULTS}>{mock}</EventsRequest>);

      await waitFor(() =>
        expect(mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            timeframe: {
              start: 1627402280000,
              end: 1627402398000,
            },
          })
        )
      );
    });
  });

  describe('custom performance metrics', () => {
    beforeEach(() => {
      jest.mocked(doEventsRequest).mockClear();
    });

    it('passes timeseriesResultTypes to child', async () => {
      jest.mocked(doEventsRequest).mockImplementation(() =>
        Promise.resolve({
          data: [[0, [COUNT_OBJ]]],
          start: 1627402280,
          end: 1627402398,
          meta: {
            fields: {
              p95_measurements_custom: 'size',
            },
            units: {
              p95_measurements_custom: 'kibibyte',
            },
          },
        } as unknown as EventsStats)
      );
      render(
        <EventsRequest {...DEFAULTS} yAxis="p95(measurements.custom)">
          {mock}
        </EventsRequest>
      );

      await waitFor(() =>
        expect(mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            timeseriesResultsTypes: {'p95(measurements.custom)': 'size'},
          })
        )
      );
    });

    it('passes timeseriesResultsUnits to child for single yAxis', async () => {
      jest.mocked(doEventsRequest).mockImplementation(() =>
        Promise.resolve({
          data: [[0, [COUNT_OBJ]]],
          start: 1627402280,
          end: 1627402398,
          meta: {
            fields: {
              p95_measurements_custom: 'size',
            },
            units: {
              p95_measurements_custom: 'kibibyte',
            },
          },
        } as unknown as EventsStats)
      );
      render(
        <EventsRequest {...DEFAULTS} yAxis="p95(measurements.custom)">
          {mock}
        </EventsRequest>
      );

      await waitFor(() =>
        expect(mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            timeseriesResultsTypes: {'p95(measurements.custom)': 'size'},
            timeseriesResultsUnits: {'p95(measurements.custom)': 'kibibyte'},
          })
        )
      );
    });

    it('passes timeseriesResultsUnits to child for multiple yAxis', async () => {
      jest.mocked(doEventsRequest).mockImplementation(() =>
        Promise.resolve({
          'p95(measurements.custom)': {
            data: [[0, [COUNT_OBJ]]],
            start: 1627402280,
            end: 1627402398,
            meta: {
              fields: {
                p95_measurements_custom: 'size',
              },
              units: {
                p95_measurements_custom: 'kibibyte',
              },
            },
          },
          'p50(measurements.lcp)': {
            data: [[0, [COUNT_OBJ]]],
            start: 1627402280,
            end: 1627402398,
            meta: {
              fields: {
                p50_measurements_lcp: 'duration',
              },
              units: {
                p50_measurements_lcp: 'millisecond',
              },
            },
          },
        } as unknown as MultiSeriesEventsStats)
      );
      render(
        <EventsRequest
          {...DEFAULTS}
          yAxis={['p95(measurements.custom)', 'p50(measurements.lcp)']}
        >
          {mock}
        </EventsRequest>
      );

      await waitFor(() =>
        expect(mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            timeseriesResultsTypes: {
              'p95(measurements.custom)': 'size',
              'p50(measurements.lcp)': 'duration',
            },
            timeseriesResultsUnits: {
              'p95(measurements.custom)': 'kibibyte',
              'p50(measurements.lcp)': 'millisecond',
            },
          })
        )
      );
    });

    it('does not include timeseriesResultsUnits when meta has no units', async () => {
      jest.mocked(doEventsRequest).mockImplementation(() =>
        Promise.resolve({
          data: [[0, [COUNT_OBJ]]],
          start: 1627402280,
          end: 1627402398,
          meta: {
            fields: {
              'count()': 'integer',
            },
          },
        } as unknown as EventsStats)
      );
      render(
        <EventsRequest {...DEFAULTS} yAxis="count()">
          {mock}
        </EventsRequest>
      );

      await waitFor(() =>
        expect(mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            timeseriesResultsTypes: {'count()': 'integer'},
            timeseriesResultsUnits: undefined,
          })
        )
      );
    });

    it('scales timeseries values according to unit meta', async () => {
      jest.mocked(doEventsRequest).mockImplementation(() =>
        Promise.resolve({
          data: [[1508208080000, [COUNT_OBJ]]],
          start: 1627402280,
          end: 1627402398,
          meta: {
            fields: {
              p95_measurements_custom: 'size',
            },
            units: {
              p95_measurements_custom: 'mebibyte',
            },
          },
        } as unknown as EventsStats)
      );
      render(
        <EventsRequest
          {...DEFAULTS}
          yAxis="p95(measurements.custom)"
          currentSeriesNames={['p95(measurements.custom)']}
        >
          {mock}
        </EventsRequest>
      );

      await waitFor(() =>
        expect(mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            timeseriesData: [
              {
                data: [{name: 1508208080000000, value: 128974848}],
                seriesName: 'p95(measurements.custom)',
              },
            ],
          })
        )
      );
    });
  });
});
