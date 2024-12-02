import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import type {FeatureFlag} from 'sentry/types/event';

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

export const EMPTY_STATE_SECTION_PROPS = {
  event: EventFixture({
    id: 'abc123def456ghi789jkl',
    contexts: {flags: {values: []}},
  }),
  project: ProjectFixture(),
  group: GroupFixture(),
};

export const NO_FLAG_CONTEXT_SECTION_PROPS_NO_CTA = {
  event: EventFixture({
    id: 'abc123def456ghi789jkl',
    contexts: {other: {}},
    platform: 'unity',
  }),
  project: ProjectFixture({platform: 'unity'}),
  group: GroupFixture({platform: 'unity'}),
};

export const NO_FLAG_CONTEXT_SECTION_PROPS_CTA = {
  event: EventFixture({
    id: 'abc123def456ghi789jkl',
    contexts: {other: {}},
    platform: 'javascript',
  }),
  project: ProjectFixture({platform: 'javascript'}),
  group: GroupFixture({platform: 'javascript'}),
};
