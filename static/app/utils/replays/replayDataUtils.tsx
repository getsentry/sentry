import first from 'lodash/first';
import type {eventWithTime} from 'rrweb/typings/types';

import {getVirtualCrumb} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {t} from 'sentry/locale';
import type {BreadcrumbTypeDefault, RawCrumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import {Entry, EntryType, Event, EventTag} from 'sentry/types/event';

export function rrwebEventListFactory(
  startTimestampMS: number,
  endTimestampMS: number,
  rawSpanData: RawSpanType[],
  rrwebEvents: eventWithTime[]
) {
  const highlights = rawSpanData
    .filter(({op, data}) => op === 'largest-contentful-paint' && data?.nodeId > 0)
    .map(({start_timestamp, data: {nodeId}}) => ({
      type: 6, // plugin type
      data: {
        nodeId,
        text: 'LCP',
      },
      timestamp: Math.floor(start_timestamp * 1000),
    }));

  const events = ([] as eventWithTime[])
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

function entriesFromEvents(events: Event[]) {
  return events.flatMap(event => event.entries);
}

export function breadcrumbValuesFromEvents(events: Event[]) {
  const fromEntries = entriesFromEvents(events).flatMap(entry =>
    entry.type === EntryType.BREADCRUMBS ? entry.data.values : []
  );
  const fromEvents = events.map(getVirtualCrumb).filter(Boolean) as RawCrumb[];

  return ([] as RawCrumb[]).concat(fromEntries).concat(fromEvents);
}

export function breadcrumbEntryFactory(
  startTimestamp: number,
  tags: EventTag[],
  rawCrumbs: RawCrumb[]
) {
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

  const stringified = rawCrumbs.map(value => JSON.stringify(value));
  const deduped = Array.from(new Set(stringified));
  const values = [initBreadcrumb].concat(deduped.map(value => JSON.parse(value)));

  values.sort((a, b) => +new Date(a?.timestamp || 0) - +new Date(b?.timestamp || 0));

  return {
    type: EntryType.BREADCRUMBS,
    data: {
      values,
    },
  } as Entry;
}

export function spanDataFromEvents(events: Event[]) {
  return entriesFromEvents(events).flatMap((entry: Entry) =>
    entry.type === EntryType.SPANS ? (entry.data as RawSpanType[]) : []
  );
}

export function spanEntryFactory(spans: RawSpanType[]) {
  spans.sort((a, b) => a.start_timestamp - b.start_timestamp);

  return {
    type: EntryType.SPANS,
    data: spans,
  } as Entry;
}

/**
 * The original `this._event.startTimestamp` and `this._event.endTimestamp`
 * are the same. It's because the root replay event is re-purposing the
 * `transaction` type, but it is not a real span occuring over time.
 * So we need to figure out the real start and end timestamps based on when
 * first and last bits of data were collected. In milliseconds.
 */
export function replayTimestamps(
  rrwebEvents: eventWithTime[],
  rawCrumbs: RawCrumb[],
  rawSpanData: RawSpanType[]
) {
  const rrwebTimestamps = rrwebEvents.map(event => event.timestamp);
  const breadcrumbTimestamps = (
    rawCrumbs.map(rawCrumb => rawCrumb.timestamp).filter(Boolean) as string[]
  ).map(timestamp => +new Date(timestamp));
  const spanStartTimestamps = rawSpanData.map(span => span.start_timestamp * 1000);
  const spanEndTimestamps = rawSpanData.map(span => span.timestamp * 1000);

  return {
    startTimestampMS: Math.min(
      ...[...rrwebTimestamps, ...breadcrumbTimestamps, ...spanStartTimestamps]
    ),
    endTimestampMS: Math.max(
      ...[...rrwebTimestamps, ...breadcrumbTimestamps, ...spanEndTimestamps]
    ),
  };
}
