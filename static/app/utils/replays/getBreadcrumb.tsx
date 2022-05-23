import {Crumb} from 'sentry/types/breadcrumbs';

export function getPrevBreadcrumb({
  crumbs,
  targetTimestampMS,
}: {
  crumbs: Crumb[];
  targetTimestampMS: number;
}) {
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
  targetTimestampMS,
}: {
  crumbs: Crumb[];
  targetTimestampMS: number;
}) {
  return crumbs.reduce<Crumb | undefined>((found, crumb) => {
    const crumbTimestampMS = +new Date(crumb.timestamp || '');

    if (crumbTimestampMS <= targetTimestampMS) {
      return found;
    }
    if (!found || crumbTimestampMS < +new Date(found.timestamp || '')) {
      return crumb;
    }
    return found;
  }, undefined);
}
