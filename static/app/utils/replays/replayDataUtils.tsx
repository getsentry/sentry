import first from 'lodash/first';
import {duration} from 'moment';

import {transformCrumbs} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import {t} from 'sentry/locale';
import type {
  BreadcrumbTypeDefault,
  BreadcrumbTypeInit,
  BreadcrumbTypeNavigation,
  Crumb,
  RawCrumb,
} from 'sentry/types/breadcrumbs';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import getMinMax from 'sentry/utils/getMinMax';
import type {
  RecordingEvent,
  ReplayCrumb,
  ReplayError,
  ReplayRecord,
  ReplaySpan,
} from 'sentry/views/replays/types';

export function mapResponseToReplayRecord(apiResponse: any): ReplayRecord {
  // Marshal special fields into tags
  const user = Object.fromEntries(
    Object.entries(apiResponse.user)
      .filter(([key, value]) => key !== 'display_name' && value)
      .map(([key, value]) => [`user.${key}`, [value]])
  );
  const unorderedTags: ReplayRecord['tags'] = {
    ...apiResponse.tags,
    ...(apiResponse.browser?.name ? {'browser.name': [apiResponse.browser.name]} : {}),
    ...(apiResponse.browser?.version
      ? {'browser.version': [apiResponse.browser.version]}
      : {}),
    ...(apiResponse.device?.brand ? {'device.brand': [apiResponse.device.brand]} : {}),
    ...(apiResponse.device?.family ? {'device.family': [apiResponse.device.family]} : {}),
    ...(apiResponse.device?.model_id
      ? {'device.model_id': [apiResponse.device.model_id]}
      : {}),
    ...(apiResponse.device?.name ? {'device.name': [apiResponse.device.name]} : {}),
    ...(apiResponse.platform ? {platform: [apiResponse.platform]} : {}),
    ...(apiResponse.releases ? {releases: [...apiResponse.releases]} : {}),
    ...(apiResponse.replay_type ? {replayType: [apiResponse.replay_type]} : {}),
    ...(apiResponse.os?.name ? {'os.name': [apiResponse.os.name]} : {}),
    ...(apiResponse.os?.version ? {'os.version': [apiResponse.os.version]} : {}),
    ...(apiResponse.sdk?.name ? {'sdk.name': [apiResponse.sdk.name]} : {}),
    ...(apiResponse.sdk?.version ? {'sdk.version': [apiResponse.sdk.version]} : {}),
    ...user,
  };

  // Sort the tags by key
  const tags = Object.keys(unorderedTags)
    .sort()
    .reduce((acc, key) => {
      acc[key] = unorderedTags[key];
      return acc;
    }, {});

  return {
    ...apiResponse,
    ...(apiResponse.started_at ? {started_at: new Date(apiResponse.started_at)} : {}),
    ...(apiResponse.finished_at ? {finished_at: new Date(apiResponse.finished_at)} : {}),
    ...(apiResponse.duration !== undefined
      ? {duration: duration(apiResponse.duration * 1000)}
      : {}),
    tags,
  };
}

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

  const firstRRWebEvent = first(events) as RecordingEvent;
  firstRRWebEvent.timestamp = replayRecord.started_at.getTime();

  return events;
}

export function breadcrumbFactory(
  replayRecord: ReplayRecord,
  errors: ReplayError[],
  rawCrumbs: ReplayCrumb[],
  spans: ReplaySpan[]
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
      return (
        !UNWANTED_CRUMB_CATEGORIES.includes(crumb.category || '') &&
        // Explicitly include replay breadcrumbs to ensure we have valid UI for them
        (!crumb.category?.startsWith('replay') || crumb.category === 'replay.mutations')
      );
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
  const breadcrumbTimestamps = rawCrumbs
    .map(rawCrumb => rawCrumb.timestamp)
    .filter(Boolean);
  const rawSpanDataFiltered = rawSpanData.filter(
    ({op}) => op !== 'largest-contentful-paint'
  );
  const spanStartTimestamps = rawSpanDataFiltered.map(span => span.startTimestamp);
  const spanEndTimestamps = rawSpanDataFiltered.map(span => span.endTimestamp);

  // Calculate min/max of each array individually, to prevent extra allocations.
  // Also using `getMinMax()` so we can handle any huge arrays.
  const {min: minRRWeb, max: maxRRWeb} = getMinMax(rrwebTimestamps);
  const {min: minCrumbs, max: maxCrumbs} = getMinMax(breadcrumbTimestamps);
  const {min: minSpanStarts} = getMinMax(spanStartTimestamps);
  const {max: maxSpanEnds} = getMinMax(spanEndTimestamps);

  return {
    startTimestampMs: Math.min(
      replayRecord.started_at.getTime(),
      minRRWeb,
      minCrumbs * 1000,
      minSpanStarts * 1000
    ),
    endTimestampMs: Math.max(
      replayRecord.finished_at.getTime(),
      maxRRWeb,
      maxCrumbs * 1000,
      maxSpanEnds * 1000
    ),
  };
}
