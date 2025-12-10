import {useMemo} from 'react';

import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

/**
 * Returns a selection object suitable for explore URLs.
 * Only resolves to actual project IDs if user has explicitly selected specific projects.
 * If "My Projects" (empty) or "All Projects" (-1), keeps as-is to avoid huge URLs.
 */
export function useExploreSelection() {
  // TODO(telemetry-experience): this is a temporary solution since explore overwrites the selection
  // remove this once we have a proper solution in explore
  const {selection} = usePageFilters();
  const {projects} = useProjects();

  return useMemo(() => {
    const hasExplicitSelection =
      selection.projects.length > 0 && !selection.projects.includes(-1);
    if (!hasExplicitSelection) {
      return selection;
    }
    const selectedProjects = getSelectedProjectList(selection.projects, projects);
    return {
      ...selection,
      projects: selectedProjects.map(p => parseInt(p.id, 10)),
    };
  }, [selection, projects]);
}
