import {normalizeUrl} from 'sentry/utils/withDomainRequired';

interface Item {
  label?: React.ReactNode;
  to?: string;
}

export function isItemActive(item: Item, exact?: boolean): boolean {
  // take off the query params for matching
  const toPathWithoutReferrer = item?.to?.split('?')[0];
  if (!toPathWithoutReferrer) {
    return false;
  }

  return (
    (exact
      ? location.pathname === normalizeUrl(toPathWithoutReferrer)
      : location.pathname.startsWith(normalizeUrl(toPathWithoutReferrer))) ||
    (item?.label === 'Discover' && location.pathname.includes('/discover/')) ||
    (item?.label === 'Dashboards' &&
      (location.pathname.includes('/dashboards/') ||
        location.pathname.includes('/dashboard/')) &&
      !location.pathname.startsWith('/settings/')) ||
    // TODO: this won't be necessary once we remove settingsHome
    (item?.label === 'Settings' && location.pathname.startsWith('/settings/')) ||
    (item?.label === 'Alerts' &&
      location.pathname.includes('/alerts/') &&
      !location.pathname.startsWith('/settings/'))
  );
}
