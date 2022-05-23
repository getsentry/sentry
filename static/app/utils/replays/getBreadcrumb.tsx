import {Crumb} from 'sentry/types/breadcrumbs';

export function getPrevBreadcrumb({
  crumbs,
  startTimestamp,
  currentHoverTime,
}: {
  crumbs: Crumb[];
  currentHoverTime: number;
  startTimestamp: number | undefined;
}) {
  if (!startTimestamp) {
    return undefined;
  }

  const targetTimestampMS = startTimestamp * 1000 + currentHoverTime;
  return crumbs.reduce<Crumb | undefined>((prev, crumb) => {
    const crumbTimestampMS = +new Date(crumb.timestamp || '');

    if (crumbTimestampMS >= targetTimestampMS) {
      return prev;
    }
    if (!prev || crumbTimestampMS > +new Date(prev.timestamp || '')) {
      return crumb;
    }
    return prev;
  }, undefined);
}

export function getNextBreadcrumb({
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
