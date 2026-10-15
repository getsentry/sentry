import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';

import {droppedEventsToOutcomeSections} from 'sentry/components/droppedData/drawer/outcomeSections';

describe('droppedEventsToOutcomeSections', () => {
  it('returns no sections for no dropped events', () => {
    expect(droppedEventsToOutcomeSections([], [])).toEqual([]);
  });

  it('groups by outcome then reason, labeling the outcome', () => {
    const sections = droppedEventsToOutcomeSections(
      [
        DroppedEventFixture({outcome: 'invalid', reason: 'cors', start: 0, count: 5}),
        DroppedEventFixture({
          outcome: 'invalid',
          reason: 'timestamp',
          start: 0,
          count: 3,
        }),
        DroppedEventFixture({
          outcome: 'filtered',
          reason: 'web-crawlers',
          start: 0,
          count: 1,
        }),
      ],
      []
    );

    expect(sections.map(s => s.label)).toEqual([
      'Invalid or Malformed',
      'Inbound Filter',
    ]);
    expect(sections[0]!.events).toBe(8);
    expect(sections[0]!.reasons.map(r => r.reason)).toEqual(['cors', 'timestamp']);
  });

  it('sums events for a reason across buckets', () => {
    const sections = droppedEventsToOutcomeSections(
      [
        DroppedEventFixture({outcome: 'invalid', reason: 'cors', start: 0, count: 2}),
        DroppedEventFixture({
          outcome: 'invalid',
          reason: 'cors',
          start: 60_000,
          count: 4,
        }),
        DroppedEventFixture({outcome: 'invalid', reason: 'cors', start: 0, count: 1}),
      ],
      []
    );

    expect(sections[0]!.reasons[0]!.events).toBe(7);
  });

  it('computes share against total events (accepted + dropped)', () => {
    const sections = droppedEventsToOutcomeSections(
      [DroppedEventFixture({outcome: 'invalid', reason: 'cors', start: 0, count: 25})],
      [
        DroppedEventFixture({
          outcome: 'accepted',
          reason: 'accepted',
          start: 0,
          count: 75,
        }),
      ]
    );

    expect(sections[0]!.shareRatio).toBe(0.25);
    expect(sections[0]!.reasons[0]!.shareRatio).toBe(0.25);
  });

  it('guards divide-by-zero when there are no events', () => {
    const sections = droppedEventsToOutcomeSections(
      [DroppedEventFixture({outcome: 'invalid', reason: 'cors', start: 0, count: 0})],
      []
    );

    expect(sections[0]!.shareRatio).toBe(0);
    expect(sections[0]!.reasons[0]!.shareRatio).toBe(0);
  });
});
