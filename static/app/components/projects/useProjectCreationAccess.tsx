import {useMemo} from 'react';

import {unassignedValue} from 'sentry/data/experimentConfig';
import {Organization, Team} from 'sentry/types';
import {useExperiment} from 'sentry/utils/useExperiment';

/**
 * Used to determine if viewer can see project creation button
 */
export function useProjectCreationAccess({
  organization,
  teams,
}: {
  organization: Organization;
  teams: Team[];
}) {
  const {experimentAssignment, logExperiment} = useExperiment(
    'ProjectCreationForAllExperiment',
    {
      logExperimentOnMount: false,
    }
  );
  const canCreateProject = useMemo(() => {
    if (
      organization.access.includes('project:admin') ||
      teams?.some(tm => tm.access.includes('team:admin'))
    ) {
      return true;
    }

    if (!organization.features.includes('team-project-creation-all')) {
      return false;
    }

    if (experimentAssignment === unassignedValue) {
      return false;
    }

    logExperiment();
    return experimentAssignment === 1;
  }, [organization, teams, experimentAssignment, logExperiment]);
  return {canCreateProject};
}
