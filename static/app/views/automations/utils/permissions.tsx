import {hasEveryAccess} from 'sentry/components/acl/access';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {Detector} from 'sentry/types/workflowEngine/detectors';

export type AutomationProjectScope = {
  includesAllProjects: boolean;
  projectIds: string[];
};

export function hasOrganizationAutomationWriteAccess(
  organization: Organization
): boolean {
  return hasEveryAccess(['alerts:write'], {organization});
}

export function hasAllProjectsAutomationWriteAccess(organization: Organization): boolean {
  return hasEveryAccess(['org:write'], {organization});
}

/** Checks alert write access through the project or its organization. */
export function hasAutomationWriteAccess({
  organization,
  project,
}: {
  organization: Organization;
  project: Project;
}): boolean {
  return hasEveryAccess(['alerts:write'], {organization, project});
}

/** Project-level writers must have access to every project attached to the alert. */
export function canEditAutomationProjectScope(
  projectScope: AutomationProjectScope | undefined,
  writableProjectIds: ReadonlySet<string>
): boolean {
  return (
    !!projectScope &&
    !projectScope.includesAllProjects &&
    projectScope.projectIds.length > 0 &&
    projectScope.projectIds.every(projectId => writableProjectIds.has(projectId))
  );
}

/** Creating an alert before attaching monitors requires organization-level access. */
export function canCreateDetachedAutomation(organization: Organization): boolean {
  return organization.access.some(scope =>
    ['org:write', 'org:admin', 'alerts:write'].includes(scope)
  );
}

export function canConnectAutomationToDetector({
  organization,
  detector,
  project,
}: {
  detector: Pick<Detector, 'projectId'>;
  organization: Organization;
  project?: Project;
}): boolean {
  // Global monitor connections require more than alert write access.
  if (detector.projectId === null) {
    return hasAllProjectsAutomationWriteAccess(organization);
  }

  return project
    ? hasAutomationWriteAccess({organization, project})
    : hasOrganizationAutomationWriteAccess(organization);
}
