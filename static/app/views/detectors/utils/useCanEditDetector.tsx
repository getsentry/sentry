import {hasEveryAccess} from 'sentry/components/acl/access';
import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import useProjects from 'sentry/utils/useProjects';
import {detectorTypeIsUserCreateable} from 'sentry/views/detectors/utils/detectorTypeConfig';

export function useCanEditDetectorWorkflowConnections({projectId}: {projectId: string}) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: projectId});
  return hasEveryAccess(['alerts:write'], {organization, project});
}

export function useCanEditDetector({
  projectId,
  detectorType,
}: {
  detectorType: DetectorType;
  projectId: string;
}) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: projectId});

  if (!project) {
    return false;
  }

  // For user-createable detectors (such as metric, cron, uptime, etc.),
  // we check for organization-level edit access (determined by an org setting).
  if (detectorTypeIsUserCreateable(detectorType)) {
    return hasEveryAccess(['alerts:write'], {organization, project});
  }

  // For non-user-createable detectors (such as error, n+1 etc.), only team admins can edit.
  return project.access.includes('alerts:write');
}

export function useCanEditDetectors({detectors}: {detectors: Detector[]}) {
  const organization = useOrganization();
  const {projects} = useProjects();

  const projectToDetectors: Record<string, Detector[]> = {};

  if (
    organization.access.includes('org:write') ||
    organization.access.includes('org:admin')
  ) {
    return true;
  }

  for (const detector of detectors) {
    const projectId = detector.projectId;
    if (!projectToDetectors[projectId]) {
      projectToDetectors[projectId] = [];
    }
    projectToDetectors[projectId]?.push(detector);
  }

  for (const projectId of Object.keys(projectToDetectors)) {
    const project = projects.find(p => p.id === projectId) ?? undefined;
    if (!project) {
      return false;
    }

    if (hasEveryAccess(['alerts:write', 'project:read'], {organization, project})) {
      // team admins can modify all detectors for projects they have admin access to
      if (project.access.includes('project:write')) {
        continue;
      }
      // members can modify only user-createable detectors for projects they have access to
      if (
        projectToDetectors[projectId]?.every(d => detectorTypeIsUserCreateable(d.type))
      ) {
        continue;
      }
    }
    return false;
  }

  return true;
}
