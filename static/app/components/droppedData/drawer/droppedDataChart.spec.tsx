import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';

import {droppedEventsToSeries} from './droppedDataChart';

describe('droppedEventsToSeries', () => {
  it('returns an empty object for no events', () => {
    expect(droppedEventsToSeries([])).toEqual({});
  });

  it('keys series by outcome, labeling each with its user-facing name', () => {
    const series = droppedEventsToSeries([
      DroppedEventFixture({outcome: 'rate_limited', start: 0, end: 1, count: 5}),
    ]);

    expect(Object.keys(series)).toEqual(['rate_limited']);
    expect(series.rate_limited!.yAxis).toBe('Rate Limited');
  });

  it('maps each known outcome to its label', () => {
    const series = droppedEventsToSeries([
      DroppedEventFixture({outcome: 'client_discard', start: 0, end: 1, count: 1}),
      DroppedEventFixture({outcome: 'filtered', start: 0, end: 1, count: 1}),
      DroppedEventFixture({outcome: 'invalid', start: 0, end: 1, count: 1}),
    ]);

    expect(Object.values(series).map(s => s.yAxis)).toEqual([
      'Client Discard',
      'Inbound Filter',
      'Invalid or Malformed',
    ]);
  });

  it('zerofills every outcome onto the shared, sorted time axis', () => {
    // client_discard has data at t=0 and t=2, rate_limited only at t=1.
    const series = droppedEventsToSeries([
      DroppedEventFixture({outcome: 'client_discard', start: 2, end: 3, count: 3}),
      DroppedEventFixture({outcome: 'client_discard', start: 0, end: 1, count: 1}),
      DroppedEventFixture({outcome: 'rate_limited', start: 1, end: 2, count: 7}),
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
      DroppedEventFixture({outcome: 'invalid', start: 0, end: 1, count: 4}),
      DroppedEventFixture({outcome: 'invalid', start: 0, end: 1, count: 6}),
    ]);

    expect(series.invalid!.values).toEqual([{timestamp: 0, value: 10}]);
  });

  it('derives the interval from an event bucket span', () => {
    const series = droppedEventsToSeries([
      DroppedEventFixture({outcome: 'filtered', start: 0, end: 60_000, count: 1}),
    ]);

    expect(series.filtered!.meta.interval).toBe(60_000);
  });
});
