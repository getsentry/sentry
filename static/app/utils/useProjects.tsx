import ProjectsStore from 'app/stores/projectsStore';
import {useLegacyStore} from 'app/stores/useLegacyStore';

/**
 * Provides projects from the ProjectStore
 */
function useProjects() {
  const {projects, loading} = useLegacyStore(ProjectsStore);

  return {projects, loadingProjects: loading};
}

export default useProjects;
