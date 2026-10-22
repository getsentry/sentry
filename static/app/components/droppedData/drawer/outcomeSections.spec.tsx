import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';

import {
  droppedEventsToOutcomeGroups,
  filterDroppedEventsByScope,
} from 'sentry/components/droppedData/drawer/outcomeSections';

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
