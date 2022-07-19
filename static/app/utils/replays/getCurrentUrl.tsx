import last from 'lodash/last';

import type {Crumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbType, BreadcrumbTypeNavigation} from 'sentry/types/breadcrumbs';
import type {EventTransaction} from 'sentry/types/event';
import {EventTag} from 'sentry/types/event';

function findUrlTag(tags: EventTag[]) {
  return tags.find(tag => tag.key === 'url');
}

function getCurrentUrl(
  event: EventTransaction,
  crumbs: Crumb[],
  currentOffsetMS: number
) {
  const startTimestampMs = event.startTimestamp * 1000;
  const currentTimeMs = startTimestampMs + Math.floor(currentOffsetMS);

  const navigationCrumbs = crumbs.filter(
    crumb => crumb.type === BreadcrumbType.NAVIGATION
  ) as BreadcrumbTypeNavigation[];

  const initialUrl = findUrlTag(event.tags)?.value || '';
  const origin = initialUrl ? new URL(initialUrl).origin : '';

  const mostRecentNavigation = last(
    navigationCrumbs.filter(({timestamp}) => +new Date(timestamp || 0) < currentTimeMs)
  )?.data?.to;

  if (!mostRecentNavigation) {
    return initialUrl;
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
