import {GroupFixture} from 'sentry-fixture/group';

import type {Group} from 'sentry/types/group';

import {aggregateSupergroupStats} from './aggregateSupergroupStats';

function makeGroup(overrides: Partial<Group>): Group {
  return GroupFixture(overrides);
}

describe('aggregateSupergroupStats', () => {
  it('returns null for empty groups', () => {
    expect(aggregateSupergroupStats([], '24h')).toBeNull();
  });

  it('sums event and user counts', () => {
    const groups = [
      makeGroup({count: '10', userCount: 3}),
      makeGroup({count: '20', userCount: 7}),
    ];
    const result = aggregateSupergroupStats(groups, '24h');
    expect(result?.eventCount).toBe(30);
    expect(result?.userCount).toBe(10);
  });

  it('takes min firstSeen and max lastSeen', () => {
    const groups = [
      makeGroup({firstSeen: '2024-01-05T00:00:00Z', lastSeen: '2024-01-10T00:00:00Z'}),
      makeGroup({firstSeen: '2024-01-01T00:00:00Z', lastSeen: '2024-01-15T00:00:00Z'}),
    ];
    const result = aggregateSupergroupStats(groups, '24h');
    expect(result?.firstSeen).toBe('2024-01-01T00:00:00Z');
    expect(result?.lastSeen).toBe('2024-01-15T00:00:00Z');
  });

  it('point-wise sums stats timeseries', () => {
    const groups = [
      makeGroup({
        stats: {
          '24h': [
            [1000, 1],
            [2000, 2],
          ],
        },
      }),
      makeGroup({
        stats: {
          '24h': [
            [1000, 3],
            [2000, 4],
          ],
        },
      }),
    ];
    const result = aggregateSupergroupStats(groups, '24h');
    expect(result?.mergedStats).toEqual([
      [1000, 4],
      [2000, 6],
    ]);
  });

  it('returns null filtered fields when no groups have filters', () => {
    const groups = [makeGroup({filtered: null})];
    const result = aggregateSupergroupStats(groups, '24h');
    expect(result?.filteredEventCount).toBeNull();
    expect(result?.filteredUserCount).toBeNull();
    expect(result?.mergedFilteredStats).toBeNull();
  });

  it('aggregates filtered stats separately', () => {
    const groups = [
      makeGroup({
        count: '100',
        userCount: 50,
        stats: {
          '24h': [
            [1000, 10],
            [2000, 20],
          ],
        },
        filtered: {
          count: '30',
          userCount: 15,
          firstSeen: '2024-01-01T00:00:00Z',
          lastSeen: '2024-01-10T00:00:00Z',
          stats: {
            '24h': [
              [1000, 3],
              [2000, 5],
            ],
          },
        },
      }),
      makeGroup({
        count: '200',
        userCount: 80,
        stats: {
          '24h': [
            [1000, 40],
            [2000, 60],
          ],
        },
        filtered: {
          count: '70',
          userCount: 25,
          firstSeen: '2024-01-02T00:00:00Z',
          lastSeen: '2024-01-12T00:00:00Z',
          stats: {
            '24h': [
              [1000, 7],
              [2000, 15],
            ],
          },
        },
      }),
    ];

    const result = aggregateSupergroupStats(groups, '24h');

    // Total stats
    expect(result?.eventCount).toBe(300);
    expect(result?.userCount).toBe(130);
    expect(result?.mergedStats).toEqual([
      [1000, 50],
      [2000, 80],
    ]);

    // Filtered stats
    expect(result?.filteredEventCount).toBe(100);
    expect(result?.filteredUserCount).toBe(40);
    expect(result?.mergedFilteredStats).toEqual([
      [1000, 10],
      [2000, 20],
    ]);
  });
});
