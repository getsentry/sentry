import {duration} from 'moment';

import type {ReplayRecord as TReplayRecord} from 'sentry/views/replays/types';

export function ReplayRecord(replayRecord: Partial<TReplayRecord> = {}): TReplayRecord {
  return {
    activity: 0,
    browser: {
      name: 'Other',
      version: '',
    },
    count_errors: 1,
    count_segments: 14,
    count_urls: 1,
    device: {
      name: '',
      brand: '',
      model_id: '',
      family: 'Other',
    },
    dist: '',
    duration: duration(84000),
    environment: 'demo',
    error_ids: ['5c83aaccfffb4a708ae893bad9be3a1c'],
    finished_at: new Date('Sep 22, 2022 5:00:03 PM UTC'),
    id: '761104e184c64d439ee1014b72b4d83b',
    longest_transaction: 0,
    os: {
      name: 'Other',
      version: '',
    },
    platform: 'javascript',
    project_id: '6273278',
    releases: ['1.0.0', '2.0.0'],
    sdk: {
      name: 'sentry.javascript.browser',
      version: '7.1.1',
    },
    started_at: new Date('Sep 22, 2022 4:58:39 PM UTC'),
    tags: {
      'browser.name': ['Other'],
      'device.family': ['Other'],
      'os.name': ['Other'],
      platform: ['javascript'],
      releases: ['1.0.0', '2.0.0'],
      'sdk.name': ['sentry.javascript.browser'],
      'sdk.version': ['7.1.1'],
      'user.ip': ['127.0.0.1'],
    },
    trace_ids: [],
    urls: ['http://localhost:3000/'],
    user: {
      id: '',
      username: '',
      email: '',
      ip: '127.0.0.1',
      display_name: '127.0.0.1',
    },
    ...replayRecord,
  };
}
