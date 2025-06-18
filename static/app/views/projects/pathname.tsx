import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {prefersStackedNav} from 'sentry/views/nav/prefersStackedNav';

const LEGACY_PROJECTS_BASE_PATHNAME = 'projects';
const PROJECTS_BASE_PATHNAME = 'insights/projects';

export function makeProjectsPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    prefersStackedNav(organization)
      ? `/organizations/${organization.slug}/${PROJECTS_BASE_PATHNAME}${path}`
      : `/organizations/${organization.slug}/${LEGACY_PROJECTS_BASE_PATHNAME}${path}`
  );
}
