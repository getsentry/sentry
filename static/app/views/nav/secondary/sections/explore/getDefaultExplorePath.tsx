import type {Organization} from 'sentry/types/organization';

export function getDefaultExplorePath(organization: Organization) {
  if (organization.features.includes('performance-trace-explorer')) {
    return 'traces';
  }

  if (organization.features.includes('discover-basic')) {
    return 'discover';
  }

  return 'profiling';
}
