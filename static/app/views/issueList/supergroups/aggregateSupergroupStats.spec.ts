import {GroupFixture} from 'sentry-fixture/group';

import type {Group} from 'sentry/types/group';

import {aggregateSupergroupStats} from './aggregateSupergroupStats';

describe('aggregateSupergroupStats', () => {
  it('returns null for empty groups', () => {
    expect(aggregateSupergroupStats([], '24h')).toBeNull();
  });

  it('sums event and user counts', () => {
    const groups = [
      GroupFixture({count: '10', userCount: 3}),
      GroupFixture({count: '20', userCount: 7}),
    ];
    const result = aggregateSupergroupStats(groups, '24h');
    expect(result?.eventCount).toBe(30);
    expect(result?.userCount).toBe(10);
  });

  it('takes min firstSeen and max lastSeen', () => {
    const groups = [
      GroupFixture({firstSeen: '2024-01-05T00:00:00Z', lastSeen: '2024-01-10T00:00:00Z'}),
      GroupFixture({firstSeen: '2024-01-01T00:00:00Z', lastSeen: '2024-01-15T00:00:00Z'}),
    ];
    const result = aggregateSupergroupStats(groups, '24h');
    expect(result?.firstSeen).toBe('2024-01-01T00:00:00Z');
    expect(result?.lastSeen).toBe('2024-01-15T00:00:00Z');
  });

  it('point-wise sums stats timeseries', () => {
    const groups = [
      GroupFixture({
        stats: {
          '24h': [
            [1000, 1],
            [2000, 2],
          ],
        },
      }),
      GroupFixture({
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
    const groups = [GroupFixture({filtered: null})];
    const result = aggregateSupergroupStats(groups, '24h');
    expect(result?.filteredEventCount).toBeNull();
    expect(result?.filteredUserCount).toBeNull();
    expect(result?.mergedFilteredStats).toBeNull();
  });

  it('treats missing counts as zero when stats have not loaded', () => {
    const result = aggregateSupergroupStats(
      [GroupFixture({count: '10', userCount: 3}), {} as Group],
      '24h'
    );
    expect(result?.eventCount).toBe(10);
    expect(result?.userCount).toBe(3);
  });

  it('aggregates filtered stats separately', () => {
    const groups = [
      GroupFixture({
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
      GroupFixture({
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
