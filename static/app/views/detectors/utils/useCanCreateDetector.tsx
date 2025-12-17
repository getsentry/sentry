import {hasEveryAccess} from 'sentry/components/acl/access';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';

import {detectorTypeIsUserCreateable} from './detectorTypeConfig';

export function useCanCreateDetector(detectorType: DetectorType | null) {
  const organization = useOrganization();

  if (!detectorType) {
    return hasEveryAccess(['alerts:write'], {organization});
  }

  return detectorTypeIsUserCreateable(detectorType);
}
