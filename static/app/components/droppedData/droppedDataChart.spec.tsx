import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';

import {droppedEventsToSeries} from './droppedDataChart';

describe('droppedEventsToSeries', () => {
  it('returns an empty object for no events', () => {
    expect(droppedEventsToSeries([])).toEqual({});
  });

  it('groups events by outcome, mapping to a user-facing label', () => {
    const series = droppedEventsToSeries([
      DroppedEventFixture({outcome: 'rate_limited', start: 0, end: 1, count: 5}),
    ]);

    expect(Object.keys(series)).toEqual(['Rate limited']);
  });

  it('maps each known outcome to its label', () => {
    const series = droppedEventsToSeries([
      DroppedEventFixture({outcome: 'client_discard', start: 0, end: 1, count: 1}),
      DroppedEventFixture({outcome: 'filtered', start: 0, end: 1, count: 1}),
      DroppedEventFixture({outcome: 'invalid', start: 0, end: 1, count: 1}),
    ]);

    expect(Object.keys(series).sort()).toEqual([
      'Client discard',
      'Inbound filter',
      'Invalid or malformed',
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
    expect(series['Client discard']!.values).toEqual([
      {timestamp: 0, value: 1},
      {timestamp: 1, value: 0},
      {timestamp: 2, value: 3},
    ]);
    expect(series['Rate limited']!.values).toEqual([
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

    expect(series['Invalid or malformed']!.values).toEqual([{timestamp: 0, value: 10}]);
  });

  it('derives the interval from an event bucket span', () => {
    const series = droppedEventsToSeries([
      DroppedEventFixture({outcome: 'filtered', start: 0, end: 60_000, count: 1}),
    ]);

    expect(series['Inbound filter']!.meta.interval).toBe(60_000);
  });
});
