import * as BreadcrumbFrameData from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import * as ReplayFrameEvents from 'sentry-fixture/replay/replayFrameEvents';
import * as ReplaySpanFrameData from 'sentry-fixture/replay/replaySpanFrameData';

import {SlowClickFrame} from 'sentry/utils/replays/types';

export function ConsoleEvent({timestamp, message}: {timestamp: Date; message?: string}) {
  return ReplayFrameEvents.BreadcrumbFrameEvent({
    timestamp,
    data: {
      payload: BreadcrumbFrameData.ConsoleFrame({
        timestamp,
        message: message ?? 'Hello World',
      }),
    },
  });
}

export function ClickEvent({timestamp}: {timestamp: Date}) {
  return ReplayFrameEvents.BreadcrumbFrameEvent({
    timestamp,
    data: {
      payload: BreadcrumbFrameData.ClickFrame({
        timestamp,
        message: 'nav[aria-label="Primary Navigation"] > div > a#sidebar-item-projects',
        data: {
          nodeId: 42,
        },
      }),
    },
  });
}

export function DeadClickEvent({timestamp}: {timestamp: Date}) {
  return ReplayFrameEvents.BreadcrumbFrameEvent({
    timestamp,
    data: {
      payload: BreadcrumbFrameData.SlowClickFrame({
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

export function NavigateEvent({
  startTimestamp,
  endTimestamp,
}: {
  endTimestamp: Date;
  startTimestamp: Date;
}) {
  const duration = endTimestamp.getTime() - startTimestamp.getTime(); // in MS

  return ReplayFrameEvents.SpanFrameEvent({
    timestamp: startTimestamp,
    data: {
      payload: ReplaySpanFrameData.NavigationFrame({
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

export function MemoryEvent({
  startTimestamp,
  endTimestamp,
}: {
  endTimestamp: Date;
  startTimestamp: Date;
}) {
  return ReplayFrameEvents.SpanFrameEvent({
    timestamp: startTimestamp,
    data: {
      payload: ReplaySpanFrameData.MemoryFrame({
        op: 'memory',
        startTimestamp,
        endTimestamp,
        description: '',
      }),
    },
  });
}
