import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {Project} from 'sentry/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

export function useOnboardingProject(): Project | undefined {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  if (projects.length === 0) {
    return undefined;
  }

  // Current selection is 'my projects' or 'all projects'
  if (
    pageFilters.selection.projects.length === 0 ||
    pageFilters.selection.projects[0] === ALL_ACCESS_PROJECTS
  ) {
    const filtered = projects.filter(p => p.firstTransactionEvent === false);
    if (filtered.length === projects.length) {
      return filtered[0];
    }
  }

  // Any other subset of projects.
  const filtered = projects.filter(
    p =>
      pageFilters.selection.projects.includes(parseInt(p.id, 10)) &&
      p.firstTransactionEvent === false
  );
  if (filtered.length === pageFilters.selection.projects.length) {
    return filtered[0];
  }

  return undefined;
}
