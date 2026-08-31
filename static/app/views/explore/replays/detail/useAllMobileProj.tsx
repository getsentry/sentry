import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {mobile} from 'sentry/data/platformCategories';
import {useProjects} from 'sentry/utils/useProjects';

export function useAllMobileProj() {
  const {
    selection: {projects: projectIds},
  } = usePageFilters();

  const {projects} = useProjects();
  const projectsSelected = projects.filter(p => projectIds.map(String).includes(p.id));

  // if no projects selected, look through all projects
  const proj = projectsSelected.length ? projectsSelected : projects;

  const allMobileProj = proj.every(p => mobile.includes(p.platform ?? 'other'));

  return {allMobileProj};
}
