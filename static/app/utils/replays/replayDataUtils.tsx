import first from 'lodash/first';

import {transformCrumbs} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import {t} from 'sentry/locale';
import type {
  BreadcrumbTypeDefault,
  BreadcrumbTypeInit,
  BreadcrumbTypeNavigation,
  Crumb,
  RawCrumb,
} from 'sentry/types/breadcrumbs';
import {
  BreadcrumbLevelType,
  BreadcrumbType,
  isBreadcrumbTypeDefault,
} from 'sentry/types/breadcrumbs';
import arrayMinAndMax from 'sentry/utils/arrayMinAndMax';
import type {
  // MemorySpanType,
  NetworkSpan,
  RecordingEvent,
  ReplayCrumb,
  ReplayError,
  ReplayRecord,
  // ReplaySpan,
} from 'sentry/views/replays/types';

// Errors if it is an interface
// See https://github.com/microsoft/TypeScript/issues/15300
// type ReplayAttachmentsByTypeMap = {
//   breadcrumbs: ReplayCrumb[];

//   /**
//    * The flattened list of rrweb events. These are stored as multiple attachments on the root replay object: the `event` prop.
//    */
//   rrwebEvents: RecordingEvent[];
//   spans: ReplaySpan[];
// };

// export const isMemorySpan = (span: ReplaySpan): span is MemorySpanType => {
//   return span.op === 'memory';
// };

// export const isNetworkSpan = (span: ReplaySpan) => {
//   return span.op.startsWith('navigation.') || span.op.startsWith('resource.');
// };

export const getBreadcrumbsByCategory = (breadcrumbs: Crumb[], categories: string[]) => {
  return breadcrumbs
    .filter(isBreadcrumbTypeDefault)
    .filter(breadcrumb => categories.includes(breadcrumb.category || ''));
};

export function rrwebEventListFactory(
  replayRecord: ReplayRecord,
  rrwebEvents: RecordingEvent[]
) {
  const events = ([] as RecordingEvent[]).concat(rrwebEvents).concat({
    type: 5, // EventType.Custom,
    timestamp: replayRecord.finished_at.getTime(),
    data: {
      tag: 'replay-end',
    },
  } as RecordingEvent);

  events.sort((a, b) => a.timestamp - b.timestamp);

  const firstRRWebEvent = first(events);
  firstRRWebEvent!.timestamp = replayRecord.started_at.getTime();

  return events;
}

export function breadcrumbFactory(
  replayRecord: ReplayRecord,
  errors: ReplayError[],
  rawCrumbs: ReplayCrumb[],
  spans: NetworkSpan[]
): Crumb[] {
  const UNWANTED_CRUMB_CATEGORIES = ['ui.focus', 'ui.blur'];

  const initialUrl = replayRecord.urls?.[0] ?? replayRecord.tags.url?.join(', ');
  const initBreadcrumb = {
    type: BreadcrumbType.INIT,
    timestamp: replayRecord.started_at.toISOString(),
    level: BreadcrumbLevelType.INFO,
    message: initialUrl,
    data: {
      action: 'replay-init',
      label: t('Start recording'),
      url: initialUrl,
    },
  } as BreadcrumbTypeInit;

  const errorCrumbs: RawCrumb[] = errors.map(error => ({
    type: BreadcrumbType.ERROR,
    level: BreadcrumbLevelType.ERROR,
    category: 'issue',
    message: error.title,
    data: {
      label: error['error.type'].join(''),
      eventId: error.id,
      groupId: error['issue.id'] || 1,
      groupShortId: error.issue,
      project: error['project.name'],
    },
    timestamp: error.timestamp,
  }));

  const spanCrumbs: (BreadcrumbTypeDefault | BreadcrumbTypeNavigation)[] = spans
    .filter(span =>
      ['navigation.navigate', 'navigation.reload', 'largest-contentful-paint'].includes(
        span.op
      )
    )
    .sort((a, b) => a.startTimestamp - b.startTimestamp)
    .map(span => {
      if (span.op.startsWith('navigation')) {
        const [, action] = span.op.split('.');
        return {
          category: 'default',
          type: BreadcrumbType.NAVIGATION,
          timestamp: new Date(span.startTimestamp * 1000).toISOString(),
          level: BreadcrumbLevelType.INFO,
          message: span.description,
          action,
          data: {
            to: span.description,
            label:
              action === 'reload'
                ? t('Reload')
                : action === 'navigate'
                ? t('Page load')
                : t('Navigation'),
            ...span.data,
          },
        };
      }

      return {
        type: BreadcrumbType.DEBUG,
        timestamp: new Date(span.startTimestamp * 1000).toISOString(),
        level: BreadcrumbLevelType.INFO,
        category: 'default',
        data: {
          action: span.op,
          ...span.data,
          label: span.op === 'largest-contentful-paint' ? t('LCP') : span.op,
        },
      };
    });

  const hasPageLoad = spans.find(span => span.op === 'navigation.navigate');

  const rawCrumbsWithTimestamp: RawCrumb[] = rawCrumbs
    .filter(crumb => {
      if (UNWANTED_CRUMB_CATEGORIES.includes(crumb.category || '')) {
        return false;
      }
      if (crumb.category?.startsWith('replay')) {
        return crumb.category === 'replay.mutations';
      }
      return true;
      // return (
      //   !UNWANTED_CRUMB_CATEGORIES.includes(crumb.category || '') &&
      //   // Explicitly include replay breadcrumbs to ensure we have valid UI for them
      //   (!crumb.category?.startsWith('replay') || crumb.category === 'replay.mutations')
      // );
    })
    .map(crumb => {
      if (crumb.category === 'replay.mutations') {
        return {
          ...crumb,
          type: BreadcrumbType.WARNING,
          level: BreadcrumbLevelType.WARNING,
          timestamp: new Date(crumb.timestamp * 1000).toISOString(),
        };
      }

      return {
        ...crumb,
        type: BreadcrumbType.DEFAULT,
        timestamp: new Date(crumb.timestamp * 1000).toISOString(),
      };
    });

  const result = transformCrumbs([
    ...(spans.length && !hasPageLoad ? [initBreadcrumb] : []),
    ...rawCrumbsWithTimestamp,
    ...errorCrumbs,
    ...spanCrumbs,
  ]);

  return result.sort((a, b) => +new Date(a.timestamp || 0) - +new Date(b.timestamp || 0));
}

// export function spansFactory(spans: ReplaySpan[]) {
//   return spans
//     .sort((a, b) => a.startTimestamp - b.startTimestamp)
//     .map(span => ({
//       ...span,
//       id: `${span.description ?? span.op}-${span.startTimestamp}-${span.endTimestamp}`,
//       timestamp: span.startTimestamp * 1000,
//     }));
// }

/**
 * We need to figure out the real start and end timestamps based on when
 * first and last bits of data were collected. In milliseconds.
 *
 * @deprecated Once the backend returns the corrected timestamps, this is not needed.
 */
export function replayTimestamps(
  replayRecord: ReplayRecord,
  rawErrors: unknown[],
  {
    rawRRWebEvents,
    rawBreadcrumbs,
    rawNetworkSpans,
    rawMemorySpans,
  }: {
    rawBreadcrumbs: unknown[];
    rawMemorySpans: unknown[];
    rawNetworkSpans: unknown[];
    rawRRWebEvents: unknown[];
  }
) {
  const errorTimestamps = rawErrors
    .map(error => new Date(error.timestamp).getTime())
    .filter(Boolean);
  const rrwebTimestamps = rawRRWebEvents.map(event => event?.timestamp).filter(Boolean);
  const breadcrumbTimestamps = rawBreadcrumbs
    .map(rawCrumb => rawCrumb?.timestamp)
    .filter(Boolean);

  const networkStartTimestamps = rawNetworkSpans.map(span => span?.startTimestamp);
  const networkEndTimestamps = rawNetworkSpans.map(span => span?.endTimestamp);
  const memoryStartTimestamps = rawMemorySpans.map(span => span?.startTimestamp);
  const memoryEndTimestamps = rawMemorySpans.map(span => span?.endTimestamp);

  // Calculate min/max of each array individually, to prevent extra allocations.
  // Also using `arrayMinAndMax()` so we can handle any huge arrays.
  const {min: minError, max: maxError} = arrayMinAndMax(errorTimestamps);
  const {min: minRRWeb, max: maxRRWeb} = arrayMinAndMax(rrwebTimestamps);
  const {min: minCrumbs, max: maxCrumbs} = arrayMinAndMax(breadcrumbTimestamps);
  const {min: minNetworkStarts} = arrayMinAndMax(networkStartTimestamps);
  const {max: maxNetworkEnds} = arrayMinAndMax(networkEndTimestamps);
  const {min: minMemoryStarts} = arrayMinAndMax(memoryStartTimestamps);
  const {max: maxMemoryEnds} = arrayMinAndMax(memoryEndTimestamps);

  return {
    startTimestampMs: Math.min(
      replayRecord.started_at.getTime(),
      minError,
      minRRWeb,
      minCrumbs * 1000,
      minNetworkStarts * 1000,
      minMemoryStarts * 1000
    ),
    endTimestampMs: Math.max(
      replayRecord.finished_at.getTime(),
      maxError,
      maxRRWeb,
      maxCrumbs * 1000,
      maxNetworkEnds * 1000,
      maxMemoryEnds * 1000
    ),
  };
}
