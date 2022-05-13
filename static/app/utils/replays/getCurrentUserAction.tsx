import {Crumb} from 'sentry/types/breadcrumbs';

export function getCurrentUserAction(
  crumbs: Crumb[],
  startTimestamp: number,
  targetOffset: number
) {
  const targetTimestamp = startTimestamp * 1000 + targetOffset;
  return crumbs.reduce<Crumb | undefined>((found, crumb) => {
    const crumbTimestamp = +new Date(crumb.timestamp || '');
    if (crumbTimestamp > targetTimestamp) {
      return found;
    }
    if (!found || +new Date(found.timestamp || '') <= crumbTimestamp) {
      return crumb;
    }
    return found;
  }, undefined);
}
