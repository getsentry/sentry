import {useEffect} from 'react';

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
    'ProjectCreationForAllExperimentV2',
    {
      logExperimentOnMount: false,
    }
  );

  const isAdmin =
    organization.access.includes('project:admin') ||
    teams?.some(tm => tm.access.includes('team:admin'));

  const shouldBeInExperiment =
    !isAdmin &&
    organization.features.includes('team-project-creation-all') &&
    experimentAssignment !== unassignedValue;

  const canCreateProject =
    isAdmin || (shouldBeInExperiment && experimentAssignment === 1);

  useEffect(() => {
    if (shouldBeInExperiment) {
      logExperiment();
    }
  }, [logExperiment, shouldBeInExperiment]);

  return {canCreateProject};
}
