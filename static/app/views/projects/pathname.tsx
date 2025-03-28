import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {prefersStackedNav} from 'sentry/views/nav/prefersStackedNav';

const LEGACY_PROJECTS_BASE_PATHNAME = 'projects';
const PROJECTS_BASE_PATHNAME = 'insights/projects';

export function makeProjectsPathname({
  path,
  orgSlug,
}: {
  orgSlug: string;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    prefersStackedNav()
      ? `/organizations/${orgSlug}/${PROJECTS_BASE_PATHNAME}${path}`
      : `/organizations/${orgSlug}/${LEGACY_PROJECTS_BASE_PATHNAME}${path}`
  );
}
