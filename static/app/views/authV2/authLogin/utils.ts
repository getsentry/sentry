export function getOrganizationSsoLoginUrl(organizationSlug: string) {
  // Organization SSO accepts pending invitations before redirecting.
  const destination = `/${organizationSlug}/`;

  return `/auth/login/${encodeURIComponent(organizationSlug)}/?next=${encodeURIComponent(destination)}`;
}
