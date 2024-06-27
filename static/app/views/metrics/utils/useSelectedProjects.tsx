import {useMemo} from 'react';

import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

export function useSelectedProjects() {
  const {selection} = usePageFilters();
  const {projects} = useProjects();

  return useMemo(() => {
    if (selection.projects.length === 0) {
      return projects.filter(project => project.isMember);
    }
    if (selection.projects.includes(-1)) {
      return projects;
    }
    return projects.filter(project => selection.projects.includes(Number(project.id)));
  }, [selection.projects, projects]);
}
