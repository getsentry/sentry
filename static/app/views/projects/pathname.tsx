import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

export function makeProjectsPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  const base = organization.features.includes('insights-to-dashboards-ui-rollout')
    ? 'projects'
    : 'insights/projects';
  return normalizeUrl(`/organizations/${organization.slug}/${base}${path}`);
}
