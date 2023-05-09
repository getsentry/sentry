import last from 'lodash/last';

import type {Crumb} from 'sentry/types/breadcrumbs';
import type {ReplayRecord} from 'sentry/views/replays/types';

function parseUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

function getCurrentUrl(
  replayRecord: ReplayRecord,
  crumbs: Crumb[],
  currentOffsetMS: number
) {
  const startTimestampMs = replayRecord.started_at.getTime();
  const currentTimeMs = startTimestampMs + Math.floor(currentOffsetMS);

  const initialUrl = replayRecord.urls[0];
  const origin = parseUrl(initialUrl)?.origin || initialUrl;

  const navigationCrumbs = crumbs.filter(
    ({timestamp}) => +new Date(timestamp || 0) <= currentTimeMs
  );

  // @ts-expect-error: Crumb types are not strongly defined in Replay
  const mostRecentNavigation = last(navigationCrumbs)?.data?.to;

  if (!mostRecentNavigation) {
    return origin;
  }

  const parsed = parseUrl(mostRecentNavigation);
  if (parsed) {
    // If `mostRecentNavigation` has the origin then we can parse it as a URL and return it
    return String(parsed);
  }
  // Otherwise we need to add the origin manually and hope the suffix makes sense.
  return origin + mostRecentNavigation;
}

export default getCurrentUrl;
