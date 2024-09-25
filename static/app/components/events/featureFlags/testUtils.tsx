import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import type {FeatureFlag} from 'sentry/types/event';
import type {RawFlagData} from 'sentry/views/issueDetails/streamline/flagSeries';

export const MOCK_FLAGS: FeatureFlag[] = [
  {
    flag: 'mobile-replay-ui',
    result: false,
  },
  {
    flag: 'web-vitals-ui',
    result: true,
  },
  {
    flag: 'enable-replay',
    result: true,
  },
  {
    flag: 'secret-feature',
    result: false,
  },
];

export const MOCK_DATA_SECTION_PROPS = {
  event: EventFixture({
    id: 'abc123def456ghi789jkl',
    contexts: {flags: {values: MOCK_FLAGS}},
  }),
  project: ProjectFixture(),
  group: GroupFixture(),
};

export const MOCK_RAW_FLAG_LOG: RawFlagData = {
  data: [
    {
      action: 'created',
      flag: 'replay-mobile-ui',
      modified_at: '2024-09-21T05:12:33',
      modified_by: '1234',
      modified_by_type: 'id',
    },
    {
      action: 'modified',
      flag: 'feature-flag-ui',
      modified_at: '2024-09-22T05:12:33',
      modified_by: '1234',
      modified_by_type: 'id',
    },
    {
      action: 'modified',
      flag: 'spam-ingest',
      modified_at: '2024-09-23T05:12:33',
      modified_by: '1234',
      modified_by_type: 'id',
    },
  ],
};
