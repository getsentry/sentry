import {
  ReplayClickFrameFixture,
  ReplayConsoleFrameFixture,
  ReplaySlowClickFrameFixture,
} from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import {
  ReplayBreadcrumbFrameEventFixture,
  ReplaySpanFrameEventFixture,
} from 'sentry-fixture/replay/replayFrameEvents';
import {
  ReplayMemoryFrameFixture,
  ReplayNavigationFrameFixture,
} from 'sentry-fixture/replay/replaySpanFrameData';

import {SlowClickFrame} from 'sentry/utils/replays/types';

export function ReplayConsoleEventFixture({
  timestamp,
  message,
}: {
  timestamp: Date;
  message?: string;
}) {
  return ReplayBreadcrumbFrameEventFixture({
    timestamp,
    data: {
      payload: ReplayConsoleFrameFixture({
        timestamp,
        message: message ?? 'Hello World',
      }),
    },
  });
}

export function ReplayClickEventFixture({timestamp}: {timestamp: Date}) {
  return ReplayBreadcrumbFrameEventFixture({
    timestamp,
    data: {
      payload: ReplayClickFrameFixture({
        timestamp,
        message: 'nav[aria-label="Primary Navigation"] > div > a#sidebar-item-projects',
        data: {
          nodeId: 42,
        },
      }),
    },
  });
}

export function ReplayDeadClickEventFixture({timestamp}: {timestamp: Date}) {
  return ReplayBreadcrumbFrameEventFixture({
    timestamp,
    data: {
      payload: ReplaySlowClickFrameFixture({
        timestamp,
        message: 'nav[aria-label="Primary Navigation"] > div > a#sidebar-item-projects',
        data: {
          node: {
            tagName: 'a',
          },
          nodeId: 42,
          url: '',
          timeAfterClickMs: 7000,
          endReason: 'timeout',
        },
      } as SlowClickFrame),
    },
  });
}

export function ReplayNavigateEventFixture({
  startTimestamp,
  endTimestamp,
}: {
  endTimestamp: Date;
  startTimestamp: Date;
}) {
  const duration = endTimestamp.getTime() - startTimestamp.getTime(); // in MS

  return ReplaySpanFrameEventFixture({
    timestamp: startTimestamp,
    data: {
      payload: ReplayNavigationFrameFixture({
        op: 'navigation.navigate',
        startTimestamp,
        endTimestamp,
        description: '',
        data: {
          size: 1149,
          decodedBodySize: 1712,
          encodedBodySize: 849,
          duration,
          domInteractive: duration - 200,
          domContentLoadedEventStart: duration - 50,
          domContentLoadedEventEnd: duration - 48,
          loadEventStart: duration, // real value would be approx the same
          loadEventEnd: duration, // real value would be approx the same
          domComplete: duration, // real value would be approx the same
          redirectCount: 0,
        },
      }),
    },
  });
}

export function ReplayMemoryEventFixture({
  startTimestamp,
  endTimestamp,
}: {
  endTimestamp: Date;
  startTimestamp: Date;
}) {
  return ReplaySpanFrameEventFixture({
    timestamp: startTimestamp,
    data: {
      payload: ReplayMemoryFrameFixture({
        op: 'memory',
        startTimestamp,
        endTimestamp,
        description: '',
      }),
    },
  });
}
