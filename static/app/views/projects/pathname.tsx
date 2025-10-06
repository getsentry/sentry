import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

const PROJECTS_BASE_PATHNAME = 'insights/projects';

export function makeProjectsPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    `/organizations/${organization.slug}/${PROJECTS_BASE_PATHNAME}${path}`
  );
}
