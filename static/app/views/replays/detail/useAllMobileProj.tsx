import {mobile} from 'sentry/data/platformCategories';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

export default function useAllMobileProj() {
  const organization = useOrganization();
  const {
    selection: {projects: projectIds},
  } = usePageFilters();

  const {projects} = useProjects();
  const projectsSelected = projects.filter(p => projectIds.map(String).includes(p.id));

  // if no projects selected, look through all projects
  const proj = projectsSelected.length ? projectsSelected : projects;

  const allMobileProj =
    organization.features.includes('session-replay-mobile-player') &&
    proj.every(p => mobile.includes(p.platform ?? 'other'));

  return {allMobileProj};
}
