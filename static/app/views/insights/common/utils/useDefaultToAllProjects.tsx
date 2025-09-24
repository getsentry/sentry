import {useEffect, useMemo} from 'react';

import {updateProjects} from 'sentry/actionCreators/pageFilters';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import usePageFilters from 'sentry/utils/usePageFilters';
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
