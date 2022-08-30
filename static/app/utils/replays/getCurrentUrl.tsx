import last from 'lodash/last';

import type {Crumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbType, BreadcrumbTypeNavigation} from 'sentry/types/breadcrumbs';
import type {ReplayRecord} from 'sentry/views/replays/types';

function getCurrentUrl(
  replayRecord: ReplayRecord,
  crumbs: Crumb[],
  currentOffsetMS: number
) {
  const startTimestampMs = replayRecord.startedAt.getTime();
  const currentTimeMs = startTimestampMs + Math.floor(currentOffsetMS);

  const navigationCrumbs = crumbs.filter(
    crumb => crumb.type === BreadcrumbType.NAVIGATION
  ) as BreadcrumbTypeNavigation[];

  const initialUrl = replayRecord.urls[0];
  const origin = initialUrl ? new URL(initialUrl).origin : '';

  const mostRecentNavigation = last(
    navigationCrumbs.filter(({timestamp}) => +new Date(timestamp || 0) <= currentTimeMs)
  )?.data?.to;

  if (!mostRecentNavigation) {
    return origin;
  }

  try {
    // If `mostRecentNavigation` has the origin then we can parse it as a URL
    const url = new URL(mostRecentNavigation);
    return String(url);
  } catch {
    // Otherwise we need to add the origin manually and hope the suffix makes sense.
    return origin + mostRecentNavigation;
  }
}

export default getCurrentUrl;
