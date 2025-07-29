import {hasEveryAccess} from 'sentry/components/acl/access';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {detectorTypeIsUserCreateable} from 'sentry/views/detectors/utils/detectorTypeConfig';

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
