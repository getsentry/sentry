import {duration} from 'moment-timezone';

import type {ReplayListRecord} from 'sentry/views/replays/types';

export function ReplayListFixture(
  replayListRecords: ReplayListRecord[] = []
): ReplayListRecord[] {
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
      clicks: [],
      count_dead_clicks: 0,
      count_errors: 0,
      count_infos: 0,
      count_rage_clicks: 0,
      count_segments: 0,
      count_urls: 0,
      count_warnings: 0,
      device: {
        brand: 'Firefox',
        family: 'Firefox',
        model_id: '111.0',
        name: 'Firefox',
      },
      dist: '111.0',
      environment: 'production',
      error_ids: [],
      info_ids: [],
      duration: duration(30000),
      finished_at: new Date('2022-09-15T06:54:00+00:00'),
      has_viewed: false,
      id: '346789a703f6454384f1de473b8b9fcc',
      is_archived: false,
      os: {
        name: 'sentry.javascript.react',
        version: '7.42.0',
      },
      ota_updates: {
        channel: 'stable',
        runtime_version: '111.0',
        update_id: '1234567890',
      },
      platform: 'javascript',
      project_id: '2',
      releases: [],
      replay_type: 'buffer',
      sdk: {
        name: 'sentry.javascript.react',
        version: '7.42.0',
      },
      started_at: new Date('2022-09-15T06:50:03+00:00'),
      tags: {},
      trace_ids: [],
      urls: [],
      warning_ids: [],
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
