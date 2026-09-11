export function getOrganizationSsoLoginUrl(organizationSlug: string) {
  const currentDestination = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  return `/auth/login/${encodeURIComponent(organizationSlug)}/?next=${encodeURIComponent(currentDestination)}`;
}
