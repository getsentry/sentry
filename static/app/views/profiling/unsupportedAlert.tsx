import {useMemo} from 'react';

import UnsupportedAlert from 'sentry/components/alerts/unsupportedAlert';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {profiling} from 'sentry/data/platformCategories';
import useProjects from 'sentry/utils/useProjects';

interface ProfilingUnsupportedAlertProps {
  selectedProjects: Array<number>;
}

export function ProfilingUnsupportedAlert({
  selectedProjects,
}: ProfilingUnsupportedAlertProps) {
  const {projects} = useProjects();
  const withoutProfilingSupport = useMemo((): boolean => {
    const projectsWithProfilingSupport = new Set(
      projects
        .filter(project => !project.platform || profiling.includes(project.platform))
        .map(project => project.id)
    );
    // if it's My Projects or All projects, only show banner if none of them
    // has profiling support
    if (selectedProjects.length === 0 || selectedProjects[0] === ALL_ACCESS_PROJECTS) {
      return projectsWithProfilingSupport.size === 0;
    }

    // if some projects are selected using the selector, show the banner if none of them
    // has profiling support
    return selectedProjects.every(
      project => !projectsWithProfilingSupport.has(String(project))
    );
  }, [selectedProjects, projects]);

  if (withoutProfilingSupport === false) return null;

  return <UnsupportedAlert featureName="Profiling" />;
}
