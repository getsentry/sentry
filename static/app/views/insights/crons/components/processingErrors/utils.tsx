import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {CheckinProcessingError} from 'sentry/views/insights/crons/types';

export function monitorErrorsApiOptions(
  organization: Organization,
  projectId: string,
  monitorSlug: string
) {
  return apiOptions.as<CheckinProcessingError[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/monitors/$monitorIdOrSlug/processing-errors/',
    {
      staleTime: 0,
      path: {
        organizationIdOrSlug: organization.slug,
        projectIdOrSlug: projectId,
        monitorIdOrSlug: monitorSlug,
      },
    }
  );
}

export function monitorListErrorsApiOptions(
  organization: Organization,
  project?: string[]
) {
  return apiOptions.as<CheckinProcessingError[]>()(
    '/organizations/$organizationIdOrSlug/processing-errors/',
    {
      staleTime: 0,
      query: {project},
      path: {organizationIdOrSlug: organization.slug},
    }
  );
}
