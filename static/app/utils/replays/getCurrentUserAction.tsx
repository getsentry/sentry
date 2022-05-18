import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {Crumb} from 'sentry/types/breadcrumbs';

export function getCurrentUserAction(
  userActionCrumbs: Crumb[] | undefined,
  startTimestamp: number | undefined,
  currentHoverTime: number
) {
  if (!startTimestamp || !userActionCrumbs) {
    return undefined;
  }

  return userActionCrumbs.reduce((prev, curr) => {
    return Math.abs(
      relativeTimeInMs(curr.timestamp ?? '', startTimestamp) - currentHoverTime
    ) <
      Math.abs(relativeTimeInMs(prev.timestamp ?? '', startTimestamp) - currentHoverTime)
      ? curr
      : prev;
  });
}

export function getNextUserAction(
  crumbs: Crumb[] | undefined,
  startTimestamp: number | undefined,
  targetOffsetMS: number
) {
  if (!crumbs || startTimestamp === undefined) {
    return undefined;
  }

  const targetTimestampMS = startTimestamp * 1000 + targetOffsetMS;
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
