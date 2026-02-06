import {Stack} from '@sentry/scraps/layout';

import ReplayBadge from 'sentry/components/replays/replayBadge';
import * as Storybook from 'sentry/stories';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';

export default Storybook.story('ReplayBadge', story => {
  const ARCHIVED_REPLAY = mapResponseToReplayRecord({
    id: '954df831ab094388ac98eee198584479',
    project_id: '1',
    started_at: new Date('2021-01-01'),
    finished_at: new Date('2021-01-01'),
    is_archived: true,
  });

  const HYDRATED_REPLAY = mapResponseToReplayRecord({
    id: '954df831ab094388ac98eee198584479',
    project_id: '1',
    trace_ids: [],
    error_ids: [],
    environment: 'prod',
    tags: {},
    user: {
      id: '123456',
      username: null,
      email: 'user@example.com',
      ip: '127.0.0.1',
      geo: {
        city: 'San Francisco',
        country_code: 'US',
        region: 'United States',
        subdivision: 'California',
      },
      display_name: 'user@example.com',
    },
    sdk: {
      name: 'sentry.javascript.react',
      version: '10.2.0',
    },
    os: {
      name: 'Windows',
      version: '>=10',
    },
    browser: {
      name: 'Chrome',
      version: '139.0.0',
    },
    device: {
      name: null,
      brand: null,
      model_id: null,
      family: null,
    },
    ota_updates: {
      channel: '',
      runtime_version: '',
      update_id: '',
    },
    urls: [],
    is_archived: false,
    activity: 1,
    count_dead_clicks: 0,
    count_errors: 0,
    count_rage_clicks: 0,
    count_segments: 3,
    count_urls: 2,
    dist: null,
    finished_at: '2025-08-14T00:19:14+00:00',
    platform: 'javascript',
    releases: ['frontend@60ddef68e7a1c0aaa608bce2b54aebd844256848'],
    replay_type: 'session',
    started_at: '2025-08-14T00:18:54+00:00',
    warning_ids: [],
    info_ids: [],
    count_infos: 0,
    count_warnings: 0,
    has_viewed: false,
  });

  story('Default', () => (
    <Stack gap="md">
      <ReplayBadge replay={HYDRATED_REPLAY} />
      <ReplayBadge replay={HYDRATED_REPLAY} />
      <ReplayBadge replay={ARCHIVED_REPLAY} />
      <ReplayBadge replay={ARCHIVED_REPLAY} />
      <ReplayBadge replay={HYDRATED_REPLAY} />
      <ReplayBadge replay={ARCHIVED_REPLAY} />
    </Stack>
  ));
});
