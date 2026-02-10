import {useEffect, useMemo} from 'react';

import {updateProjects} from 'sentry/components/pageFilters/actions';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

/**
 * Defaults page filter selection to "All Projects" when no projects are selected and user has no team projects.
 */
export function useDefaultToAllProjects() {
  const {selection} = usePageFilters();
  const {projects, initiallyLoaded} = useProjects();

  const myProjects = useMemo(
    () => projects.filter(project => project.isMember),
    [projects]
  );

  useEffect(() => {
    if (initiallyLoaded && selection.projects.length === 0 && myProjects.length === 0) {
      updateProjects([ALL_ACCESS_PROJECTS], undefined, {
        save: true,
      });
    }
  }, [selection.projects.length, myProjects.length, initiallyLoaded]);
}
