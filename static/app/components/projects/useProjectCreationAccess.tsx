import {useMemo} from 'react';

import {unassignedValue} from 'sentry/data/experimentConfig';
import {Organization} from 'sentry/types';
import {useExperiment} from 'sentry/utils/useExperiment';

/**
 * Used to determine if viewer can see project creation button
 */
export function useProjectCreationAccess(organization: Organization) {
  const {experimentAssignment, logExperiment} = useExperiment(
    'ProjectCreationForAllExperiment',
    {
      logExperimentOnMount: false,
    }
  );

  const canCreateProject = useMemo(() => {
    if (
      organization.access.includes('project:admin') ||
      organization.access.includes('project:write')
    ) {
      return true;
    }

    if (!organization.features.includes('organizations:team-project-creation-all')) {
      return false;
    }

    if (experimentAssignment === unassignedValue) {
      return false;
    }

    logExperiment();
    return experimentAssignment === 1;
  }, [organization, experimentAssignment, logExperiment]);
  return {canCreateProject};
}
