import last from 'lodash/last';

import {transformCrumbs} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import {BreadcrumbType, BreadcrumbTypeNavigation} from 'sentry/types/breadcrumbs';
import {EventTag} from 'sentry/types/event';
import type ReplayReader from 'sentry/utils/replays/replayReader';

function findUrlTag(tags: EventTag[]) {
  return tags.find(tag => tag.key === 'url');
}

function getCurrentUrl(replay: ReplayReader, currentOffsetMS: number) {
  const event = replay.getEvent();
  const crumbs = replay.getRawCrumbs();

  const startTimestampMs = event.startTimestamp * 1000;
  const currentTimeMs = startTimestampMs + Math.floor(currentOffsetMS);

  const navigationCrumbs = transformCrumbs(crumbs).filter(
    crumb => crumb.type === BreadcrumbType.NAVIGATION
  ) as BreadcrumbTypeNavigation[];

  const initialUrl = findUrlTag(event.tags)?.value || '';
  const origin = initialUrl ? new URL(initialUrl).origin : '';

  const mostRecentNavigation = last(
    navigationCrumbs.filter(({timestamp}) => +new Date(timestamp || 0) < currentTimeMs)
  )?.data?.to;

  return mostRecentNavigation ? origin + mostRecentNavigation : initialUrl;
}

export default getCurrentUrl;
