import type {Organization} from 'sentry/types/organization';

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

export function makeMonitorListErrorsQueryKey(
  organization: Organization,
  project?: string[]
) {
  return [
    `/organizations/${organization.slug}/processing-errors/`,
    {query: {project}},
  ] as const;
}
