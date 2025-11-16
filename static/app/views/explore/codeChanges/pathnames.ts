import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

interface MakeCodeChangesPathnameArgs {
  organization: Organization;
  path: '/' | `/${string}/`;
}

export function makeCodeChangesPathname({
  path,
  organization,
}: MakeCodeChangesPathnameArgs) {
  return normalizeUrl(`/organizations/${organization.slug}/explore/code-changes${path}`);
}
