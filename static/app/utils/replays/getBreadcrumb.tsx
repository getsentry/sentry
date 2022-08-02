import {Crumb} from 'sentry/types/breadcrumbs';

export function getPrevBreadcrumb({
  crumbs,
  targetTimestampMs,
  allowExact = false,
}: {
  crumbs: Crumb[];
  targetTimestampMs: number;
  allowExact?: boolean;
}) {
  return crumbs.reduce<Crumb | undefined>((prev, crumb) => {
    const crumbTimestampMS = +new Date(crumb.timestamp || '');

    if (
      crumbTimestampMS > targetTimestampMs ||
      (!allowExact && crumbTimestampMS === targetTimestampMs)
    ) {
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
  targetTimestampMs,
  allowExact = false,
}: {
  crumbs: Crumb[];
  targetTimestampMs: number;
  allowExact?: boolean;
}) {
  return crumbs.reduce<Crumb | undefined>((found, crumb) => {
    const crumbTimestampMS = +new Date(crumb.timestamp || '');

    if (
      crumbTimestampMS < targetTimestampMs ||
      (!allowExact && crumbTimestampMS === targetTimestampMs)
    ) {
      return found;
    }
    if (!found || crumbTimestampMS < +new Date(found.timestamp || '')) {
      return crumb;
    }
    return found;
  }, undefined);
}
