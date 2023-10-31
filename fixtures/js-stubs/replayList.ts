import {duration} from 'moment';

import type {ReplayListRecord as TReplayListRecord} from 'sentry/views/replays/types';

export function ReplayList(
  replayListRecords: TReplayListRecord[] = []
): TReplayListRecord[] {
  if (replayListRecords.length) {
    return replayListRecords;
  }
  return [
    {
      activity: 1,
      browser: {
        name: 'Firefox',
        version: '111.0',
      },
      count_dead_clicks: 0,
      count_rage_clicks: 0,
      count_errors: 0,
      duration: duration(30000),
      finished_at: new Date('2022-09-15T06:54:00+00:00'),
      id: '346789a703f6454384f1de473b8b9fcc',
      is_archived: false,
      os: {
        name: 'sentry.javascript.react',
        version: '7.42.0',
      },
      project_id: '2',
      started_at: new Date('2022-09-15T06:50:03+00:00'),
      user: {
        display_name: 'testDisplayName',
        email: '',
        id: '147086',
        ip: '127.0.0.1',
        username: 'testDisplayName',
      },
    },
  ];
}
