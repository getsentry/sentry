import {hasEveryAccess} from 'sentry/components/acl/access';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {hasDetectorWriteAccess} from 'sentry/views/detectors/utils/permissions';

import {detectorTypeIsUserCreateable} from './detectorTypeConfig';

export function useCanCreateDetector(detectorType: DetectorType | null) {
  const organization = useOrganization();
  const {projects} = useProjects();

  if (detectorType && !detectorTypeIsUserCreateable(detectorType)) {
    return false;
  }

  return (
    hasEveryAccess(['alerts:write'], {organization}) ||
    projects.some(project => hasDetectorWriteAccess({organization, project}))
  );
}
