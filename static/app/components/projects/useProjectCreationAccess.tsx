import type {Organization} from 'sentry/types/organization';

/**
 * Used to determine if viewer can see project creation button
 */
export function useProjectCreationAccess({organization}: {organization: Organization}) {
  const canCreateProject =
    organization.access.includes('project:admin') ||
    organization.features.includes('team-roles');
  return {canCreateProject};
}
