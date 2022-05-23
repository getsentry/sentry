import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {Crumb} from 'sentry/types/breadcrumbs';

export function getPrevUserAction({
  crumbs,
  startTimestamp,
  currentHoverTime,
}: {
  crumbs: Crumb[];
  currentHoverTime: number;
  startTimestamp: number | undefined;
}) {
  if (!startTimestamp || crumbs.length < 1) {
    return undefined;
  }

  const prevUserAction = crumbs.reduce((prev, curr) => {
    return curr &&
      currentHoverTime > relativeTimeInMs(curr.timestamp ?? '', startTimestamp)
      ? curr
      : prev;
  });

  return currentHoverTime >=
    relativeTimeInMs(prevUserAction.timestamp ?? '', startTimestamp)
    ? prevUserAction
    : undefined;
}

export function getNextUserAction({
  crumbs,
  startTimestampSec,
  targetOffsetMS,
}: {
  crumbs: Crumb[];
  startTimestampSec: number | undefined;
  targetOffsetMS: number;
}) {
  if (startTimestampSec === undefined) {
    return undefined;
  }

  const targetTimestampMS = startTimestampSec * 1000 + targetOffsetMS;
  return crumbs.reduce<Crumb | undefined>((found, crumb) => {
    const crumbTimestampMS = +new Date(crumb.timestamp || '');

    if (crumbTimestampMS < targetTimestampMS) {
      return found;
    }
    if (!found || crumbTimestampMS < +new Date(found.timestamp || '')) {
      return crumb;
    }
    return found;
  }, undefined);
}
