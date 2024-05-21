import type {Organization} from 'sentry/types';

export function makeMonitorErrorsQueryKey(
  organization: Organization,
  projectId: string,
  monitorSlug: string
) {
  return [
    `/projects/${organization.slug}/${projectId}/monitors/${monitorSlug}/processing-errors/`,
    {},
  ] as const;
}
