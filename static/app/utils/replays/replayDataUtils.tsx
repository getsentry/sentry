import first from 'lodash/first';

import {transformCrumbs} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import {t} from 'sentry/locale';
import type {
  BreadcrumbTypeDefault,
  BreadcrumbTypeNavigation,
  Crumb,
  RawCrumb,
} from 'sentry/types/breadcrumbs';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {
  MemorySpanType,
  RecordingEvent,
  ReplayCrumb,
  ReplayError,
  ReplayRecord,
  ReplaySpan,
} from 'sentry/views/replays/types';

export const isMemorySpan = (span: ReplaySpan): span is MemorySpanType => {
  return span.op === 'memory';
};

export const isNetworkSpan = (span: ReplaySpan) => {
  return span.op.startsWith('navigation.') || span.op.startsWith('resource.');
};

export function mapResponseToReplayRecord(apiResponse: any): ReplayRecord {
  return {
    ...apiResponse,
    ...(apiResponse.startedAt ? {startedAt: new Date(apiResponse.startedAt)} : {}),
    ...(apiResponse.finishedAt ? {finishedAt: new Date(apiResponse.finishedAt)} : {}),
  };
}

export function rrwebEventListFactory(
  replayRecord: ReplayRecord,
  rrwebEvents: RecordingEvent[]
) {
  const events = ([] as RecordingEvent[]).concat(rrwebEvents).concat({
    type: 5, // EventType.Custom,
    timestamp: replayRecord.finishedAt.getTime(),
    data: {
      tag: 'replay-end',
    },
  });

  events.sort((a, b) => a.timestamp - b.timestamp);

  const firstRRWebEvent = first(events) as RecordingEvent;
  firstRRWebEvent.timestamp = replayRecord.startedAt.getTime();

  return events;
}

export function breadcrumbFactory(
  replayRecord: ReplayRecord,
  errors: ReplayError[],
  rawCrumbs: ReplayCrumb[],
  spans: ReplaySpan[]
): Crumb[] {
  const UNWANTED_CRUMB_CATEGORIES = ['ui.focus', 'ui.blur'];

  const initialUrl = replayRecord.tags.url?.join(', ');
  const initBreadcrumb = {
    type: BreadcrumbType.INIT,
    timestamp: replayRecord.startedAt.toISOString(),
    level: BreadcrumbLevelType.INFO,
    message: initialUrl,
    data: {
      action: 'replay-init',
      label: t('Start recording'),
      url: initialUrl,
    },
  } as BreadcrumbTypeDefault;

  const errorCrumbs: RawCrumb[] = errors.map(error => ({
    type: BreadcrumbType.ERROR,
    level: BreadcrumbLevelType.ERROR,
    category: 'exception',
    message: error.title,
    data: {
      label: error['error.type'].join(''),
      eventId: error.id,
      groupId: error['issue.id'] || 1,
      groupShortId: error.issue || 'POKEDEX-4NN',
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
      return !UNWANTED_CRUMB_CATEGORIES.includes(crumb.category || '');
    })
    .map(crumb => {
      return {
        ...crumb,
        type: BreadcrumbType.DEFAULT,
        timestamp: new Date(crumb.timestamp * 1000).toISOString(),
      };
    });

  const result = transformCrumbs([
    ...(!hasPageLoad ? [initBreadcrumb] : []),
    ...rawCrumbsWithTimestamp,
    ...errorCrumbs,
    ...spanCrumbs,
  ]);

  return result.sort((a, b) => +new Date(a.timestamp || 0) - +new Date(b.timestamp || 0));
}

export function spansFactory(spans: ReplaySpan[]) {
  return spans
    .sort((a, b) => a.startTimestamp - b.startTimestamp)
    .map(span => ({
      ...span,
      id: `${span.description ?? span.op}-${span.startTimestamp}-${span.endTimestamp}`,
      timestamp: span.startTimestamp * 1000,
    }));
}

/**
 * We need to figure out the real start and end timestamps based on when
 * first and last bits of data were collected. In milliseconds.
 *
 * @deprecated Once the backend returns the corrected timestamps, this is not needed.
 */
export function replayTimestamps(
  replayRecord: ReplayRecord,
  rrwebEvents: RecordingEvent[],
  rawCrumbs: ReplayCrumb[],
  rawSpanData: ReplaySpan[]
) {
  const rrwebTimestamps = rrwebEvents.map(event => event.timestamp).filter(Boolean);
  const breadcrumbTimestamps = (
    rawCrumbs.map(rawCrumb => rawCrumb.timestamp).filter(Boolean) as number[]
  )
    .map(timestamp => +new Date(timestamp * 1000))
    .filter(Boolean);
  const spanStartTimestamps = rawSpanData.map(span => span.startTimestamp * 1000);
  const spanEndTimestamps = rawSpanData.map(span => span.endTimestamp * 1000);

  return {
    startTimestampMs: Math.min(
      replayRecord.startedAt.getTime(),
      ...[...rrwebTimestamps, ...breadcrumbTimestamps, ...spanStartTimestamps]
    ),
    endTimestampMs: Math.max(
      replayRecord.finishedAt.getTime(),
      ...[...rrwebTimestamps, ...breadcrumbTimestamps, ...spanEndTimestamps]
    ),
  };
}
