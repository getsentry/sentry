import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import {EntryType} from 'sentry/types/event';

const oneMinuteBeforeEventFixture = '2019-05-21T18:00:48.76Z';
export const MOCK_BREADCRUMBS = [
  {
    message: 'warning message',
    category: 'Warning Category',
    level: BreadcrumbLevelType.WARNING,
    type: BreadcrumbType.INFO,
    timestamp: oneMinuteBeforeEventFixture,
  },
  {
    message: 'log message',
    category: 'Log Category',
    level: BreadcrumbLevelType.LOG,
    type: BreadcrumbType.INFO,
    timestamp: oneMinuteBeforeEventFixture,
  },
  {
    message: 'navigation message',
    category: 'Navigation Category',
    level: BreadcrumbLevelType.FATAL,
    type: BreadcrumbType.NAVIGATION,
    timestamp: oneMinuteBeforeEventFixture,
  },
  {
    message: 'query message',
    category: 'Query Category',
    level: BreadcrumbLevelType.DEBUG,
    type: BreadcrumbType.QUERY,
    timestamp: oneMinuteBeforeEventFixture,
  },
  {
    message: 'my logger',
    category: 'custom.logger',
    level: BreadcrumbLevelType.UNDEFINED,
    type: BreadcrumbType.DEFAULT,
    timestamp: oneMinuteBeforeEventFixture,
  },
  {
    message: 'my analytics',
    category: 'analytics.event',
    level: BreadcrumbLevelType.INFO,
    type: BreadcrumbType.DEFAULT,
    timestamp: oneMinuteBeforeEventFixture,
  },
] as const;
const MOCK_BREADCRUMB_ENTRY = {
  type: EntryType.BREADCRUMBS,
  data: {
    values: MOCK_BREADCRUMBS,
  },
};
export const MOCK_EXCEPTION_ENTRY = {
  type: EntryType.EXCEPTION,
  data: {
    values: [
      {
        value: 'Error',
      },
    ],
  },
};
export const MOCK_DATA_SECTION_PROPS = {
  event: EventFixture({
    id: 'abc123def456ghi789jkl',
    entries: [MOCK_BREADCRUMB_ENTRY, MOCK_EXCEPTION_ENTRY],
  }),
  project: ProjectFixture(),
  group: GroupFixture(),
};
