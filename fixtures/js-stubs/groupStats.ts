import {GroupStats as GroupStatsType} from 'sentry/types';

export function GroupStats(params: Partial<GroupStatsType> = {}): GroupStatsType {
  return {
    count: '327482',
    firstSeen: '2019-04-05T19:44:05.963Z',
    id: '1',
    lastSeen: '2019-04-11T01:08:59Z',
    stats: {
      '24h': [
        [1517281200, 2],
        [1517310000, 1],
      ],
      '30d': [
        [1514764800, 1],
        [1515024000, 122],
      ],
    },
    userCount: 35097,
    filtered: null,
    ...params,
  };
}
