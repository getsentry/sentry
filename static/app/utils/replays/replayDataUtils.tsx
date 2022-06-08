import first from 'lodash/first';

import {transformCrumbs} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import {t} from 'sentry/locale';
import type {BreadcrumbTypeDefault, Crumb, RawCrumb} from 'sentry/types/breadcrumbs';
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
  rawSpanData: ReplaySpan[],
  rrwebEvents: RecordingEvent[]
) {
  const highlights = rawSpanData
    .filter(({op, data}) => op === 'largest-contentful-paint' && data?.nodeId > 0)
    .map(({startTimestamp, data: {nodeId}}) => ({
      type: 6, // plugin type
      data: {
        nodeId,
        text: 'LCP',
      },
      timestamp: Math.floor(startTimestamp * 1000),
    }));

  const events = ([] as RecordingEvent[])
    .concat(rrwebEvents)
    .concat(highlights)
    .concat({
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
  rawCrumbs: ReplayCrumb[]
): Crumb[] {
  const {tags} = rootEvent;
  const initBreadcrumb = {
    type: BreadcrumbType.INIT,
    timestamp: new Date(startTimestamp).toISOString(),
    level: BreadcrumbLevelType.INFO,
    action: 'replay-init',
    message: t('Start recording'),
    data: {
      url: tags.find(tag => tag.key === 'url')?.value,
    },
  } as BreadcrumbTypeDefault;

  const errorCrumbs: RawCrumb[] = errors.map(error => ({
    type: BreadcrumbType.ERROR,
    level: BreadcrumbLevelType.ERROR,
    category: 'exception',
    data: {
      type: error['error.type'],
      value: error['error.value'],
    },
    timestamp: error.timestamp,
  }));

  const result = transformCrumbs([
    initBreadcrumb,
    ...(rawCrumbs.map(({timestamp, ...crumb}) => ({
      ...crumb,
      type: BreadcrumbType.DEFAULT,
      timestamp: new Date(timestamp * 1000).toISOString(),
    })) as RawCrumb[]),
    ...errorCrumbs,
  ]);

  return result.sort((a, b) => +new Date(a.timestamp || 0) - +new Date(b.timestamp || 0));
}

export function spansFactory(spans: ReplaySpan[]) {
  return spans.sort((a, b) => a.startTimestamp - b.startTimestamp);
}

/**
 * The original `this._event.startTimestamp` and `this._event.endTimestamp`
 * are the same. It's because the root replay event is re-purposing the
 * `transaction` type, but it is not a real span occuring over time.
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
