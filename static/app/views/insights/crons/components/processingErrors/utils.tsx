import type {Organization} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';

export function makeMonitorErrorsQueryKey(
  organization: Organization,
  projectId: string,
  monitorSlug: string
) {
  return [
    getApiUrl(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/monitors/$monitorIdOrSlug/processing-errors/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: projectId,
          monitorIdOrSlug: monitorSlug,
        },
      }
    ),
    {},
  ] as const;
}

export function makeMonitorListErrorsQueryKey(
  organization: Organization,
  project?: string[]
) {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/processing-errors/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
    {query: {project}},
  ] as const;
}
