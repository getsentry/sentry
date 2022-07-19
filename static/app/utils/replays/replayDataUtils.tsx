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
import {Event} from 'sentry/types/event';
import type {
  RecordingEvent,
  ReplayCrumb,
  ReplayError,
  ReplaySpan,
} from 'sentry/views/replays/types';

export function rrwebEventListFactory(
  startTimestampMS: number,
  endTimestampMS: number,
  rrwebEvents: RecordingEvent[]
) {
  const events = ([] as RecordingEvent[]).concat(rrwebEvents).concat({
    type: 5, // EventType.Custom,
    timestamp: endTimestampMS,
    data: {
      tag: 'replay-end',
    },
  });
  events.sort((a, b) => a.timestamp - b.timestamp);

  const firstRRWebEvent = first(events);
  if (firstRRWebEvent) {
    firstRRWebEvent.timestamp = startTimestampMS;
  }

  return events;
}

export function breadcrumbFactory(
  startTimestamp: number,
  rootEvent: Event,
  errors: ReplayError[],
  rawCrumbs: ReplayCrumb[],
  spans: ReplaySpan[]
): Crumb[] {
  const {tags} = rootEvent;
  const initialUrl = tags.find(tag => tag.key === 'url')?.value;
  const initBreadcrumb = {
    type: BreadcrumbType.INIT,
    timestamp: new Date(startTimestamp).toISOString(),
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
    message: error['error.value'],
    data: {
      label: error['error.type'],
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

  const result = transformCrumbs([
    ...(!hasPageLoad ? [initBreadcrumb] : []),
    ...(rawCrumbs.map(({timestamp, ...crumb}) => ({
      ...crumb,
      type: BreadcrumbType.DEFAULT,
      timestamp: new Date(timestamp * 1000).toISOString(),
    })) as RawCrumb[]),
    ...errorCrumbs,
    ...spanCrumbs,
  ]);

  return result.sort((a, b) => +new Date(a.timestamp || 0) - +new Date(b.timestamp || 0));
}

export function spansFactory(spans: ReplaySpan[]) {
  return spans.sort((a, b) => a.startTimestamp - b.startTimestamp);
}

/**
 * The original `this._event.startTimestamp` and `this._event.endTimestamp`
 * are the same. It's because the root replay event is re-purposing the
 * `transaction` type, but it is not a real span occurring over time.
 * So we need to figure out the real start and end timestamps based on when
 * first and last bits of data were collected. In milliseconds.
 */
export function replayTimestamps(
  rrwebEvents: RecordingEvent[],
  rawCrumbs: ReplayCrumb[],
  rawSpanData: ReplaySpan[]
) {
  const rrwebTimestamps = rrwebEvents.map(event => event.timestamp);
  const breadcrumbTimestamps = (
    rawCrumbs.map(rawCrumb => rawCrumb.timestamp).filter(Boolean) as number[]
  ).map(timestamp => +new Date(timestamp * 1000));
  const spanStartTimestamps = rawSpanData.map(span => span.startTimestamp * 1000);
  const spanEndTimestamps = rawSpanData.map(span => span.endTimestamp * 1000);

  return {
    startTimestampMS: Math.min(
      ...[...rrwebTimestamps, ...breadcrumbTimestamps, ...spanStartTimestamps]
    ),
    endTimestampMS: Math.max(
      ...[...rrwebTimestamps, ...breadcrumbTimestamps, ...spanEndTimestamps]
    ),
  };
}
