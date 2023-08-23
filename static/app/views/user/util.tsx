import Link from 'sentry/components/links/link';
import {IconUser} from 'sentry/icons';

export function getUserDetailsUrl(
  organizationSlug: string,
  user: Record<string, any> | undefined
) {
  if (!user) {
    return null;
  }

  const validUserProperties = Object.entries(user).filter(
    ([key, value]) => value && !key.includes('name')
  );
  if (!validUserProperties.length) {
    return null;
  }

  const displayName = user.display_name || user.name || validUserProperties[0][1];
  return `/organizations/${organizationSlug}/user/?name=${encodeURIComponent(
    displayName
  )}&userKey=${encodeURIComponent(
    validUserProperties[0][0]
  )}&userValue=${encodeURIComponent(validUserProperties[0][1])}`;
}

export function renderUserDetailsLink(
  organizationSlug: string,
  user: Record<string, any> | undefined
) {
  const url = getUserDetailsUrl(organizationSlug, user);

  if (!url) {
    return null;
  }

  return (
    <Link to={url}>
      <IconUser />
    </Link>
  );
}
