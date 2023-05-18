import {Organization} from 'sentry/types';

/**
 * Used to determine if viewer can see project creation button
 */
export function canCreateProject(organization: Organization): boolean {
  return (
    organization.access.includes('project:admin') ||
    organization.access.includes('project:write')
  );
}
