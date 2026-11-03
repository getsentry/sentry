import type {ECharts} from 'echarts';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {BaseChart} from 'sentry/components/charts/baseChart';
import type {EChartDataZoomHandler} from 'sentry/types/echarts';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

import {DroppedDataChart, droppedEventsToSeries} from './droppedDataChart';

jest.mock('sentry/components/charts/baseChart', () => ({
  BaseChart: jest.fn(() => null),
}));

describe('DroppedDataChart', () => {
  it('does not zoom or change the time range', () => {
    const {router} = render(
      <DroppedDataChart
        droppedEvents={[OutcomeRowFixture({outcome: 'filtered', count: 5})]}
        colors={{filtered: '#000'}}
        dataset={DiscoverDatasets.SPANS}
        hasAskSeer={false}
        selection={{}}
        onSelectionChange={jest.fn()}
      />,
      {
        initialRouterConfig: {
          location: {pathname: '/explore/traces/', query: {statsPeriod: '14d'}},
        },
      }
    );

    const props = jest.mocked(BaseChart).mock.calls.at(-1)![0];
    expect(props.toolBox).toEqual({});

    act(() => {
      props.onDataZoom?.(
        {
          type: 'datazoom',
          start: 0,
          end: 100,
          batch: [{startValue: 0, endValue: 600_000}],
        } as Parameters<EChartDataZoomHandler>[0],
        {} as ECharts
      );
    });

    expect(router.location.query).toEqual({statsPeriod: '14d'});
  });
});

describe('droppedEventsToSeries', () => {
  it('returns an empty object for no events', () => {
    expect(droppedEventsToSeries([])).toEqual({});
  });

  it('keys series by outcome, labeling each with its user-facing name', () => {
    const series = droppedEventsToSeries([
      OutcomeRowFixture({outcome: 'rate_limited', start: 0, end: 1, count: 5}),
    ]);

    expect(Object.keys(series)).toEqual(['rate_limited']);
    expect(series.rate_limited!.yAxis).toBe('Rate Limited');
  });

  it('maps each known outcome to its label', () => {
    const series = droppedEventsToSeries([
      OutcomeRowFixture({outcome: 'client_discard', start: 0, end: 1, count: 1}),
      OutcomeRowFixture({outcome: 'filtered', start: 0, end: 1, count: 1}),
      OutcomeRowFixture({outcome: 'invalid', start: 0, end: 1, count: 1}),
    ]);

    expect(Object.values(series).map(s => s.yAxis)).toEqual([
      'Client Discard',
      'Inbound Filters',
      'Invalid or Malformed',
    ]);
  });

  it('zerofills every outcome onto the shared, sorted time axis', () => {
    // client_discard has data at t=0 and t=2, rate_limited only at t=1.
    const series = droppedEventsToSeries([
      OutcomeRowFixture({outcome: 'client_discard', start: 2, end: 3, count: 3}),
      OutcomeRowFixture({outcome: 'client_discard', start: 0, end: 1, count: 1}),
      OutcomeRowFixture({outcome: 'rate_limited', start: 1, end: 2, count: 7}),
    ]);

    // Both series cover all three sorted timestamps, zerofilled where missing.
    expect(series.client_discard!.values).toEqual([
      {timestamp: 0, value: 1},
      {timestamp: 1, value: 0},
      {timestamp: 2, value: 3},
    ]);
    expect(series.rate_limited!.values).toEqual([
      {timestamp: 0, value: 0},
      {timestamp: 1, value: 7},
      {timestamp: 2, value: 0},
    ]);
  });

  it('sums count for events sharing an outcome and timestamp', () => {
    const series = droppedEventsToSeries([
      OutcomeRowFixture({outcome: 'invalid', start: 0, end: 1, count: 4}),
      OutcomeRowFixture({outcome: 'invalid', start: 0, end: 1, count: 6}),
    ]);

    expect(series.invalid!.values).toEqual([{timestamp: 0, value: 10}]);
  });

  it('derives the interval from an event bucket span', () => {
    const series = droppedEventsToSeries([
      OutcomeRowFixture({outcome: 'filtered', start: 0, end: 60_000, count: 1}),
    ]);

    expect(series.filtered!.meta.interval).toBe(60_000);
  });
});
