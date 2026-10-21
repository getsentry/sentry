import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';

import {
  droppedEventsToOutcomeGroups,
  droppedEventsToOutcomeSections,
  filterDroppedEventsByScope,
} from 'sentry/components/droppedData/drawer/outcomeSections';

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

describe('droppedEventsToOutcomeGroups', () => {
  it('splits reasons by tag, treating untagged drops as intentional', () => {
    const {unintentional, intentional} = droppedEventsToOutcomeGroups(
      [
        DroppedEventFixture({
          outcome: 'client_discard',
          reason: 'queue_overflow',
          tags: ['unintentional'],
        }),
        DroppedEventFixture({
          outcome: 'client_discard',
          reason: 'sample_rate',
          tags: ['intentional'],
        }),
        DroppedEventFixture({outcome: 'invalid', reason: 'cors', tags: []}),
      ],
      [],
      'all'
    );

    expect(unintentional.flatMap(s => s.reasons.map(r => r.reason))).toEqual([
      'queue_overflow',
    ]);
    expect(intentional.flatMap(s => s.reasons.map(r => r.reason))).toEqual([
      'sample_rate',
      'cors',
    ]);
  });

  const scopedDroppedEvents = [
    DroppedEventFixture({count: 10, tags: ['unintentional']}),
    DroppedEventFixture({outcome: 'filtered', count: 30, tags: ['intentional']}),
  ];
  const scopedAcceptedEvents = [
    DroppedEventFixture({outcome: 'accepted', reason: 'accepted', count: 60}),
  ];

  it('computes shares against accepted and every drop in the all scope', () => {
    const {unintentional, intentional} = droppedEventsToOutcomeGroups(
      scopedDroppedEvents,
      scopedAcceptedEvents,
      'all'
    );

    expect(unintentional[0]!.shareRatio).toBe(0.1);
    expect(intentional[0]!.shareRatio).toBe(0.3);
  });

  it('excludes intentional drops from groups and shares in the contributing scope', () => {
    const {unintentional, intentional} = droppedEventsToOutcomeGroups(
      scopedDroppedEvents,
      scopedAcceptedEvents,
      'contributing'
    );

    expect(intentional).toEqual([]);
    expect(unintentional[0]!.events).toBe(10);
    expect(unintentional[0]!.shareRatio).toBeCloseTo(10 / 70);
    expect(unintentional[0]!.reasons[0]!.shareRatio).toBeCloseTo(10 / 70);
  });
});

describe('filterDroppedEventsByScope', () => {
  const droppedEvents = [
    DroppedEventFixture({reason: 'queue_overflow', tags: ['unintentional']}),
    DroppedEventFixture({reason: 'sample_rate', tags: ['intentional']}),
    DroppedEventFixture({reason: 'cors', tags: []}),
  ];

  it('keeps only unintentional drops in the contributing scope', () => {
    expect(
      filterDroppedEventsByScope(droppedEvents, 'contributing').map(e => e.reason)
    ).toEqual(['queue_overflow']);
  });

  it('keeps every drop in the all scope', () => {
    expect(filterDroppedEventsByScope(droppedEvents, 'all')).toEqual(droppedEvents);
  });
});
